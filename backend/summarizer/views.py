# views.py
import logging
from urllib.parse import urlparse
import socket
from urllib3.util.retry import Retry

import google.generativeai as genai
import requests
from bs4 import BeautifulSoup
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from google.api_core import retry
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from requests.adapters import HTTPAdapter

from .models import Summary

logger = logging.getLogger(__name__)

# Initialize Gemini AI with enhanced configuration
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    generation_config = {
        "temperature": 0.3,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 2048,
    }
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    gemini_model = genai.GenerativeModel(
        'gemini-2.5-flash',
        generation_config=generation_config,
        safety_settings=safety_settings
    )
except Exception as e:
    logger.error(f"Failed to initialize Gemini: {str(e)}")
    gemini_model = None




class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        email = request.data.get("email")

        if not username or not password or not email:
            return Response(
                {"error": "Username, password, and email are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create(
            username=username,
            password=make_password(password),
            email=email
        )
        user.save()

        return Response({"message": "User registered successfully"}, status=status.HTTP_201_CREATED)



class SummarizeView(APIView):
    permission_classes = [IsAuthenticated]
    
    def validate_summary_type(self, summary_type):
        valid_types = ['short', 'medium', 'long']
        if summary_type not in valid_types:
            raise ValueError(
                f"Invalid summary_type. Must be one of: {', '.join(valid_types)}"
            )

    def validate_content(self, text):
        """Validate content before sending to Gemini"""
        if not text or len(text.strip()) < 50:
            raise ValueError("Content too short (minimum 50 characters)")
        if len(text) > 15000:
            raise ValueError("Content too long (maximum 15,000 characters)")
        return text.strip()

    @retry.Retry(
        initial=1.0,
        maximum=10.0,
        multiplier=2.0,
        deadline=30.0,
        exceptions=(genai.types.StopCandidateException,)
    )
    def generate_summary(self, text, summary_type):
        if not gemini_model:
            raise ConnectionError("Gemini AI service not configured")
            
        # Enhanced prompt engineering
        prompt = f"""
        Please generate a {summary_type} summary of the provided content adhering to the following professional standards:

1. Content Requirements:
- Maintain all critical information and key concepts
- Preserve original meaning and context
- Retain technical terms and proper nouns
- Keep numerical data and statistics

2. Quality Standards:
- Use clear, professional language
- Ensure grammatical accuracy
- Maintain logical flow and coherence
- Be factually precise

3. Format Specifications:
- Length: {summary_type} (specify word count or sentence count)
- Style: Professional/academic tone
- Structure: Complete, well-formed sentences
- Language: Match original text language

4. Processing Instructions:
- Exclude examples unless critical to understanding
- Remove redundant information
- Condense without oversimplifying
- Prioritize information by importance

Original Content:
{text}

Please provide the summary with these professional considerations in mind.
        """
        
        try:
            response = gemini_model.generate_content(prompt)
            
            # Validate response
            if not response.text or len(response.text.strip()) < 10:
                raise ValueError("Empty or invalid summary generated")
                
            return response.text.strip()
        except Exception as e:
            logger.error(f"Generation error: {str(e)}")
            raise

    def post(self, request):
        try:
            text = request.data.get("text", "").strip()
            summary_type = request.data.get("summary_type", "medium").strip().lower()
            
            # Validate input
            try:
                self.validate_summary_type(summary_type)
                text = self.validate_content(text)
            except ValueError as e:
                return Response(
                    {"error": str(e), "code": "invalid_input"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Generate summary with enhanced error handling
            try:
                summary = self.generate_summary(text, summary_type)
            except genai.types.StopCandidateException as e:
                logger.error(f"Content filter triggered: {str(e)}")
                return Response(
                    {
                        "error": "Content violation detected in generation",
                        "code": "content_violation",
                        "solutions": [
                            "Try different content",
                            "Reformulate your text",
                            "Contact support if this persists"
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            except ValueError as e:
                logger.error(f"Empty summary generated: {str(e)}")
                return Response(
                    {
                        "error": "Failed to generate meaningful summary",
                        "code": "empty_summary",
                        "solutions": [
                            "Try different content",
                            "Use a different summary length",
                            "Break content into smaller sections"
                        ]
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY
                )
            except Exception as e:
                logger.error(f"Generation failed: {str(e)}")
                return Response(
                    {
                        "error": "AI service unavailable",
                        "code": "service_unavailable",
                        "solutions": [
                            "Try again later",
                            
                        ]
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            # Save to database with error handling
            try:
                Summary.objects.create(
                    user=request.user,
                    original_text=text[:5000],
                    summary_text=summary,
                    summary_type=summary_type,
                )
            except Exception as e:
                logger.error(f"Database save failed: {str(e)}")
                # Continue even if save fails

            return Response({
                "summary": summary,
                "characters": len(summary),
                "summary_type": summary_type,
                "success": True
            })

        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            return Response(
                {
                    "error": "Internal server error",
                    "code": "server_error",
                    "solutions": [
                        "Try again later",
                        
                    ]
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FetchUrlContentView(APIView):
    permission_classes = [IsAuthenticated]
    
    def __init__(self):
        super().__init__()
        # Enhanced session configuration
        self.session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[400, 403, 408, 429, 500, 502, 503, 504]
        )
        adapter = HTTPAdapter(
            max_retries=retries,
            pool_connections=10,
            pool_maxsize=10
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

    def validate_url(self, url):
        try:
            result = urlparse(url)
            if not all([result.scheme, result.netloc]):
                raise ValueError("Invalid URL format")
            if result.scheme not in ['http', 'https']:
                raise ValueError("Only http/https URLs are allowed")
            
            # Enhanced domain validation
            domain = result.netloc.split(':')[0]
            if not all(part.isalnum() or part in ('-', '.') for part in domain.split('.')):
                raise ValueError("Invalid domain name")
            
            # Verify DNS resolution
            socket.getaddrinfo(domain, None)
            return True
        except (ValueError, socket.gaierror) as e:
            raise ValueError(f"URL validation failed: {str(e)}")

    def extract_main_content(self, soup):
        """Enhanced content extraction with multiple fallbacks"""
        # Try common article containers first
        selectors = [
            'article', 
            'main', 
            'div.article', 
            'div.content', 
            'div.post', 
            'div.story',
            'section.main-content'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                return element.get_text(' ', strip=True)
        
        # Fallback to body text extraction
        text_parts = []
        for tag in ['p', 'div', 'section']:
            elements = soup.find_all(tag)
            for el in elements:
                text = el.get_text(' ', strip=True)
                if len(text.split()) > 10:  # Only include meaningful paragraphs
                    text_parts.append(text)
        
        if text_parts:
            return ' '.join(text_parts)
        
        # Final fallback to all text
        return soup.get_text(' ', strip=True)

    def post(self, request):
        try:
            url = request.data.get("url", "").strip()
            
            if not url:
                return Response(
                    {"error": "URL is required", "code": "missing_url"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                self.validate_url(url)
            except ValueError as e:
                return Response(
                    {"error": str(e), "code": "invalid_url"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.5",
            }
            
            try:
                response = self.session.get(
                    url,
                    headers=headers,
                    timeout=(3.05, 10),
                    allow_redirects=True,
                    verify=True
                )
                response.raise_for_status()
                
                content_type = response.headers.get('Content-Type', '')
                if 'text/html' not in content_type:
                    return Response(
                        {
                            "error": "URL does not return HTML content",
                            "code": "non_html_content"
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
            except requests.exceptions.SSLError:
                return Response(
                    {
                        "error": "SSL verification failed",
                        "code": "ssl_error",
                        "solutions": ["Try a different URL"]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            except requests.exceptions.Timeout:
                return Response(
                    {
                        "error": "Website took too long to respond",
                        "code": "timeout",
                        "solutions": ["Try again later", "Check the URL"]
                    },
                    status=status.HTTP_408_REQUEST_TIMEOUT
                )
            except requests.exceptions.TooManyRedirects:
                return Response(
                    {
                        "error": "Too many redirects",
                        "code": "redirect_loop",
                        "solutions": ["Try a different URL"]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            except requests.exceptions.HTTPError as e:
                status_code = e.response.status_code
                if status_code == 403:
                    return Response(
                        {
                            "error": "Access forbidden (403)",
                            "code": "forbidden",
                            "solutions": [
                                "Try a different URL",
                                "The website may block automated requests"
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                return Response(
                    {
                        "error": f"HTTP error {status_code}",
                        "code": f"http_{status_code}",
                        "solutions": ["Try a different URL"]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            except requests.exceptions.RequestException as e:
                logger.error(f"URL fetch failed: {str(e)}")
                return Response(
                    {
                        "error": "Could not fetch URL content",
                        "code": "fetch_failed",
                        "solutions": ["Try a different URL", "Check your connection"]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Clean up the document
                for element in soup(['script', 'style', 'nav', 'footer', 
                                   'iframe', 'img', 'button', 'form',
                                   'header', 'aside', 'svg', 'link',
                                   'meta', 'noscript']):
                    element.decompose()
                
                content = self.extract_main_content(soup)
                
                if not content or len(content.strip()) < 50:
                    return Response(
                        {
                            "error": "No readable content found on page",
                            "code": "no_content",
                            "solutions": [
                                "Try a different URL",
                                "The page may require JavaScript"
                            ]
                        }, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                return Response({
                    "content": content[:15000],  # Limit content size
                    "source_url": url,
                    "success": True
                })
                
            except Exception as e:
                logger.error(f"Content parsing failed: {str(e)}")
                return Response(
                    {
                        "error": "Failed to parse page content",
                        "code": "parse_error",
                        "solutions": ["Try a different URL"]
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"Unexpected error in URL fetch: {str(e)}", exc_info=True)
            return Response(
                {
                    "error": "Internal server error",
                    "code": "server_error",
                    "solutions": ["Try again later", "Contact support"]
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )