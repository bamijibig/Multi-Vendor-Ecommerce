from django.urls import path

from .views import (
    BuyerPrepareCheckoutView,
    BuyerSourceAndBuildCartView,
    SellerApproveListingView,
    SellerBulkApproveAllView,
    SellerBulkBatchDetailView,
    SellerBulkTemplateView,
    SellerBulkUploadView,
    SellerDraftViewSet,
    SellerGenerateListingView,
)

draft_list = SellerDraftViewSet.as_view({"get": "list"})
draft_detail = SellerDraftViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update"}
)
draft_reject = SellerDraftViewSet.as_view({"post": "reject"})

urlpatterns = [
    path(
        "buyer/source-and-build-cart/",
        BuyerSourceAndBuildCartView.as_view(),
        name="buyer-source-and-build-cart",
    ),
    path(
        "buyer/prepare-checkout/",
        BuyerPrepareCheckoutView.as_view(),
        name="buyer-prepare-checkout",
    ),
    path(
        "seller/generate-listing/",
        SellerGenerateListingView.as_view(),
        name="seller-generate-listing",
    ),
    path("seller/drafts/", draft_list, name="seller-draft-list"),
    path("seller/drafts/<int:pk>/", draft_detail, name="seller-draft-detail"),
    path(
        "seller/drafts/<int:pk>/reject/",
        draft_reject,
        name="seller-draft-reject",
    ),
    path(
        "seller/approve-listing/<int:draft_id>/",
        SellerApproveListingView.as_view(),
        name="seller-approve-listing",
    ),
    path(
        "seller/bulk-upload/template/",
        SellerBulkTemplateView.as_view(),
        name="seller-bulk-template",
    ),
    path(
        "seller/bulk-upload/",
        SellerBulkUploadView.as_view(),
        name="seller-bulk-upload",
    ),
    path(
        "seller/bulk-upload/<int:batch_id>/",
        SellerBulkBatchDetailView.as_view(),
        name="seller-bulk-batch-detail",
    ),
    path(
        "seller/bulk-upload/<int:batch_id>/approve-all/",
        SellerBulkApproveAllView.as_view(),
        name="seller-bulk-approve-all",
    ),
]
