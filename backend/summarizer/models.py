from django.db import models
from django.contrib.auth.models import User

class Summary(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='summaries')
    original_text = models.TextField()
    summary_text = models.TextField()
    source_url = models.URLField(blank=True, null=True)
    summary_type = models.CharField(
        max_length=10,
        choices=[('short', 'Short'), ('medium', 'Medium'), ('long', 'Long')],
        default='medium'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Summary by {self.user.username} on {self.created_at.strftime('%Y-%m-%d %H:%M')}"
