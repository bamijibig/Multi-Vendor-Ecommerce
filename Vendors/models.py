from django.db import models
from django.utils.text import slugify
from accounts.models import CustomUser
# Create your models here.

class VendorStore(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_ACTIVE = "ACTIVE"
    STATUS_SUSPENDED = "SUSPENDED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending approval"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_SUSPENDED, "Suspended"),
    ]

    user = models.ForeignKey(CustomUser, verbose_name=("vendor_user"), on_delete=models.CASCADE)
    name = models.CharField(max_length=100, unique=True)
    slug = models.CharField(max_length=115,unique=True, blank=True)
    logo = models.ImageField( upload_to='media/vendoreStore/logo/', height_field=None, width_field=None, max_length=None,blank=True,null=True)
    cover_photo = models.ImageField( upload_to='media/vendoreStore/coverPhoto/', height_field=None, width_field=None, max_length=None,blank=True,null=True)
    is_official = models.BooleanField(default=False, db_index=True)
    official_badge = models.CharField(max_length=60, blank=True, default="Official Store")
    official_tagline = models.CharField(max_length=160, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True
    )
    status_note = models.TextField(blank=True)
    status_updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_visible(self):
        return self.status == self.STATUS_ACTIVE

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super(VendorStore,self).save(*args, **kwargs)
    
    def __str__(self):
        return self.name
    

