# views.py
import logging
import socket
from urllib.parse import urlparse
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

# Initialize Gemini AI once
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-pro')
except Exception as e:
    logger.error(f"Failed to initialize Gemini: {str(e)}")
    gemini_model = None


class RegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            username = request.data.get('username', '').strip()
            password = request.data.get('password', '').strip()
            email = request.data.get('email', '').strip()

            if not username or not password:
                return Response(
                    {'error': 'Username and password are required.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            if len(username) < 4:
                return Response(
                    {'error': 'Username must be at least 4 characters.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if len(password) < 8:
                return Response(
                    {'error': 'Password must be at least 8 characters.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if User.objects.filter(username=username).exists():
                return Response(
                    {'error': 'Username already exists.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            if email and User.objects.filter(email=email).exists():
                return Response(
                    {'error': 'Email already in use.'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.create(
                username=username,
                password=make_password(password),
                email=email if email else ''
            )
            
            return Response(
                {
                    'message': 'User registered successfully.',
                    'username': user.username
                }, 
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            logger.error(f"Registration error: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Internal server error'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SummarizeView(APIView):
    permission_classes = [IsAuthenticated]
    
    def validate_summary_type(self, summary_type):
        valid_types = ['short', 'medium', 'long']
        if summary_type not in valid_types:
            raise ValueError(
                f"Invalid summary_type. Must be one of: {', '.join(valid_types)}"
            )

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
            
        config = {
            "max_output_tokens": {
                "short": 100,
                "medium": 200,
                "long": 400
            }.get(summary_type, 200),
            "temperature": 0.3
        }
        return gemini_model.generate_content(
            f"Summarize this in {summary_type} length: {text}",
            generation_config=config
        )

    def post(self, request):
        try:
            text = request.data.get("text", "").strip()
            summary_type = request.data.get("summary_type", "medium").strip().lower()
            
            if not text:
                return Response(
                    {"error": "No text provided."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                self.validate_summary_type(summary_type)
            except ValueError as e:
                return Response(
                    {"error": str(e)}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                response = self.generate_summary(text, summary_type)
                summary = response.text
            except genai.types.StopCandidateException as e:
                logger.error(f"Gemini content filter triggered: {str(e)}")
                return Response(
                    {"error": "Content violation detected in generation"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                logger.error(f"Gemini API error: {str(e)}")
                return Response(
                    {"error": "AI service unavailable"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            # Save to database
            try:
                Summary.objects.create(
                    user=request.user,
                    original_text=text[:5000],
                    summary_text=summary,
                    summary_type=summary_type,
                )
            except Exception as e:
                logger.error(f"Failed to save summary: {str(e)}")

            return Response({
                "summary": summary,
                "characters": len(summary),
                "summary_type": summary_type
            })

        except Exception as e:
            logger.error(f"Unexpected error in summarization: {str(e)}", exc_info=True)
            return Response(
                {"error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FetchUrlContentView(APIView):
    permission_classes = [IsAuthenticated]
    
    def __init__(self):
        super().__init__()
        # Configure requests session with retry
        self.session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504]
        )
        self.session.mount('http://', HTTPAdapter(max_retries=retries))
        self.session.mount('https://', HTTPAdapter(max_retries=retries))

    def validate_url(self, url):
        try:
            result = urlparse(url)
            if not all([result.scheme, result.netloc]):
                raise ValueError("Invalid URL format")
            if result.scheme not in ['http', 'https']:
                raise ValueError("Only http/https URLs are allowed")
            
            # Verify DNS resolution
            socket.getaddrinfo(result.netloc, None)
            return True
        except (ValueError, socket.gaierror) as e:
            raise ValueError(f"URL validation failed: {str(e)}")

    def post(self, request):
        try:
            url = request.data.get("url", "").strip()
            
            if not url:
                return Response(
                    {"error": "URL is required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                self.validate_url(url)
            except ValueError as e:
                return Response(
                    {"error": str(e)}, 
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
                    timeout=(3.05, 10),  # Connect timeout, read timeout
                    allow_redirects=True,
                    verify=True  # Enable SSL verification
                )
                response.raise_for_status()
                
                # Check content type
                content_type = response.headers.get('Content-Type', '')
                if 'text/html' not in content_type:
                    return Response(
                        {"error": "URL does not return HTML content"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                    
            except requests.exceptions.SSLError:
                return Response(
                    {"error": "SSL verification failed"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except requests.exceptions.Timeout:
                return Response(
                    {"error": "Website took too long to respond"},
                    status=status.HTTP_408_REQUEST_TIMEOUT
                )
            except requests.exceptions.TooManyRedirects:
                return Response(
                    {"error": "Too many redirects"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except requests.exceptions.RequestException as e:
                logger.error(f"URL fetch failed: {str(e)}")
                return Response(
                    {"error": "Could not fetch URL content"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Parse content with improved extraction
            try:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Remove unwanted elements
                for element in soup(['script', 'style', 'nav', 'footer', 
                                   'iframe', 'img', 'button', 'form',
                                   'header', 'aside', 'svg', 'link']):
                    element.decompose()
                    
                # Improved content extraction
                text_parts = []
                for tag in ['article', 'main', 'div.content', 'section']:
                    elements = soup.find_all(tag)
                    for el in elements:
                        text_parts.append(el.get_text(' ', strip=True))
                
                # Fallback to paragraph text if no specific sections found
                if not text_parts:
                    paragraphs = soup.find_all('p')
                    text_parts = [p.get_text(' ', strip=True) for p in paragraphs]
                
                # Final fallback
                if not text_parts:
                    text_parts = list(soup.stripped_strings)
                    
                text = ' '.join(text_parts)
                
                if not text:
                    return Response(
                        {"error": "No readable content found on page"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                return Response({
                    "content": text[:15000],  # Limit content size
                    "source_url": url
                })
                
            except Exception as e:
                logger.error(f"Content parsing failed: {str(e)}")
                return Response(
                    {"error": "Failed to parse page content"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"Unexpected error in URL fetch: {str(e)}", exc_info=True)
            return Response(
                {"error": "Internal server error"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )