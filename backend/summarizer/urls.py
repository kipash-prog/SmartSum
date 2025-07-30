from django.urls import path
from .views import SummarizeView, FetchUrlContentView
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import RegisterView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('summarize/', SummarizeView.as_view(), name='summarize'),
    path('fetch-url-content/', FetchUrlContentView.as_view(), name='fetch-url-content'),
]