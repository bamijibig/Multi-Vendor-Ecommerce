from django.contrib import admin

from .models import CategoryCommissionRule, TaxConfiguration, VendorLedgerEntry, VendorPayout

admin.site.register(CategoryCommissionRule)
admin.site.register(TaxConfiguration)
admin.site.register(VendorLedgerEntry)
admin.site.register(VendorPayout)