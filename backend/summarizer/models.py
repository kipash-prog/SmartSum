from django.db import models
from django.contrib.auth.models import User

class Summary(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    original_text = models.TextField()
    summary_text = models.TextField()
    source_url = models.URLField(blank=True, null=True)
    summary_type = models.CharField(
        max_length=10,
        choices=[('short', 'Short'), ('medium', 'Medium'), ('long', 'Long')],
        default='medium'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_complete = models.BooleanField(default=True)

    def __str__(self):
        return f"Summary ({self.summary_type}) by {self.user.username}"

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]