/**
 * EditBarcode Component
 * This component handles bulk editing of product barcodes.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit product barcodes in bulk
 * 
 * @author Manar Bakhat
 */

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Text,
  BlockStack,
  Card,
  InlineStack,
  Icon,
  Button,
  Select,
  TextField,
  DataTable,
  Banner,
  Spinner,
  Badge,
  ProgressBar,
  Pagination,
  Divider
} from "@shopify/polaris";
import { FilterIcon, ResetIcon, BarcodeIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData } from "@remix-run/react";
import Swal from 'sweetalert2';

interface Product {
  id: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  status: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants?: {
    edges: Array<{
      node: {
        barcode: string;
      };
    }>;
  };
}

interface ActionData {
  data?: {
    products: {
      edges: Array<{
        node: Product;
      }>;
    };
  };
  error?: string;
  success?: boolean;
  partialFailure?: boolean;
  message?: string;
  details?: string;
  results?: Array<{
    productId: string;
    productTitle: string;
    variantUpdates: Array<{
      variantId: string;
      originalBarcode: string;
      newBarcode: string;
      skipped: boolean;
    }>;
  }>;
  stats?: {
    updated: number;
    skipped: number;
    errors: number;
    variantsUpdated: number;
    variantsWithErrors: number;
  };
}

function EditBarcode() {
  // State variables
  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  
  // Barcode editing option
  const [barcodeValue, setBarcodeValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle filtered products
  useEffect(() => {
    if (actionData) {
      if (actionData.data?.products?.edges) {
        const filteredProducts = actionData.data.products.edges.map(({ node }) => ({
          id: node.id.replace('gid://shopify/Product/', ''),
          title: node.title,
          description: node.description,
          productType: node.productType,
          vendor: node.vendor,
          status: node.status,
          featuredImage: node.featuredImage,
          priceRangeV2: node.priceRangeV2,
          variants: node.variants
        }));
        setProducts(filteredProducts);
        setHasSearched(true);
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Handle action data response for success/error
  useEffect(() => {
    if (actionData) {
      console.log('[EditBarcode] Received action data:', actionData);
      setIsSubmitting(false);
      
      if (actionData.success) {
        console.log('[EditBarcode] Bulk edit successful!');
        console.log('[EditBarcode] Success message:', actionData.message);
        
        if (actionData.results) {
          console.log('[EditBarcode] Update results:', actionData.results);
          
          // Vérifier si des variants ont réellement été modifiés
          const updatedVariants = actionData.results.flatMap(result => 
            (result.variantUpdates || []).filter(update => !update.skipped)
          );
          
          const variantsWithSameBarcode = updatedVariants.filter(v => v.originalBarcode === v.newBarcode);
          
          if (updatedVariants.length === 0) {
            console.warn('[EditBarcode] Aucun variant n\'a été modifié malgré le succès signalé');
            
            // No variants were updated, show a warning instead
            Swal.fire({
              title: 'Attention',
              text: 'Operation completed, but no barcodes were changed. This could be because the barcodes already had the specified values.',
              icon: 'warning',
              confirmButtonText: 'OK',
              confirmButtonColor: "#008060"
            });
            
          } else if (variantsWithSameBarcode.length > 0 && variantsWithSameBarcode.length === updatedVariants.length) {
            console.warn('[EditBarcode] Tous les variants ont le même barcode avant et après la mise à jour:', variantsWithSameBarcode);
            
            // All variants had the same barcode before and after, show a warning
            Swal.fire({
              title: 'Attention',
              text: 'Operation completed, but all barcodes already had the specified values. No changes were made.',
              icon: 'warning',
              confirmButtonText: 'OK',
              confirmButtonColor: "#008060"
            });
            
          } else {
            // Message de succès simplifié
            const successMessage = 'Barcodes updated successfully!';

            Swal.fire({
              title: 'Success!',
              text: successMessage,
              icon: 'success',
              confirmButtonText: 'OK',
              confirmButtonColor: "#008060"
            });
          }
          
          // Reset form fields in all cases
          setBarcodeValue('');
          
        } else if (actionData.partialFailure) {
          // Partial success with errors
          Swal.fire({
            title: 'Partial Success',
            text: actionData.message || 'Some barcodes were updated, but there were errors with others.',
            icon: 'warning',
            confirmButtonText: 'OK',
            confirmButtonColor: "#008060"
          });
          
          // Reset form fields
          setBarcodeValue('');
          
        } else {
          // Si pas de résultats détaillés, afficher le message simple
          Swal.fire({
            title: 'Success!',
            text: 'Barcodes updated successfully!',
            icon: 'success',
            confirmButtonText: 'OK',
            confirmButtonColor: "#008060"
          });
        }
      } else if (actionData.error) {
        console.error('[EditBarcode] Bulk edit failed:', actionData.error);
        console.error('[EditBarcode] Error details:', actionData.details || 'No details provided');
        
        // Vérifier si l'erreur concerne l'API GraphQL manquante
        let errorMessage = actionData.error;
        const errorIcon: 'error' | 'warning' | 'info' | 'success' | 'question' = 'error';
        
        if (actionData.error.includes("doesn't exist on type 'Mutation'")) {
          errorMessage = "There's a compatibility issue with the Shopify API. Please contact support for assistance.";
        } else if (actionData.error.includes('Barcodes were not updated')) {
          errorMessage = "Barcodes could not be updated. Please try again later or contact support.";
        } else if (actionData.error.includes('API access') || actionData.error.includes('token')) {
          errorMessage = "There was an issue with your Shopify API access. Please refresh the page or contact support.";
        }
        
        Swal.fire({
          title: 'Error',
          text: errorMessage,
          icon: errorIcon,
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      }
    }
  }, [actionData]);

  // Calculate pagination
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  const rows = currentProducts.map((product) => [
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img 
        src={product.featuredImage?.url || 'https://cdn.shopify.com/s/files/1/0757/9956/5321/files/placeholder.png'} 
        alt={product.featuredImage?.altText || 'Product image'} 
        style={{ 
          width: '60px', 
          height: '60px', 
          objectFit: 'cover',
          borderRadius: '4px'
        }}
        onError={(e) => {
          e.currentTarget.src = 'https://cdn.shopify.com/s/files/1/0757/9956/5321/files/placeholder.png';
        }}
      />
      <div>
        <Text variant="bodyMd" as="p" fontWeight="bold">{product.title}</Text>
        <Text variant="bodySm" as="p" tone="subdued">{product.vendor}</Text>
      </div>
    </div>,
    <div style={{ 
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      position: 'relative'
    }}>
      <Text variant="bodySm" as="p" tone="subdued">
        {product.description ? (
          <div style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {product.description}
          </div>
        ) : 'No description'}
      </Text>
    </div>,
    <div>
      <Text variant="bodySm" as="p">{product.productType || 'N/A'}</Text>
    </div>,
    <div>
      <Text variant="bodySm" as="p">
        {product.variants?.edges?.map(edge => edge.node.barcode).filter(Boolean).join(', ') || 'No barcode'}
      </Text>
    </div>,
    <div>
      <Badge tone={product.status === 'ACTIVE' ? 'success' : 'warning'}>
        {product.status}
      </Badge>
    </div>,
    <div style={{ textAlign: 'right' }}>
      <Text variant="bodyMd" as="p" fontWeight="bold">
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: product.priceRangeV2.minVariantPrice.currencyCode
        }).format(parseFloat(product.priceRangeV2.minVariantPrice.amount))}
      </Text>
    </div>
  ]);

  const fieldOptions = [
    { label: 'Title', value: 'title' },
    { label: 'Description', value: 'description' },
    { label: 'Product ID', value: 'productId' }
  ];

  // Base condition options for non-description fields
  const baseConditionOptions = [
    { label: 'is', value: 'is' },
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
  ];

  // Product ID condition options (only 'is')
  const productIdConditionOptions = [
    { label: 'is', value: 'is' }
  ];

  // Condition options for description field (without 'is')
  const descriptionConditionOptions = [
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
    { label: 'empty', value: 'empty' }
  ];

  // Handle field change
  const handleFieldChange = (value: string) => {
    setSelectedField(value);
    // If switching to description and current condition is 'is', change to 'contains'
    if (value === 'description' && selectedCondition === 'is') {
      setSelectedCondition('contains');
    }
    // If switching to productId, change condition to 'is'
    if (value === 'productId') {
      setSelectedCondition('is');
    }
  };

  const handlePreview = () => {
    setIsLoading(true);
    setHasSearched(true);
    const formData = new FormData();
    formData.append("field", selectedField);
    formData.append("condition", selectedCondition);
    formData.append("value", filterValue);
    submit(formData, { method: "post" });
  };

  const handleClearFilters = () => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
  };

  const handleBulkEdit = () => {
    // Check if products have been filtered first
    if (!products.length) {
      // Show error if no products are filtered
      Swal.fire({
        title: 'Error',
        text: 'Please filter and preview products first before starting bulk edit.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    // Validation for barcode value
    if (!barcodeValue) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a value to update barcode to.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    // Submit form logic
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "barcode");
    formData.append("productIds", JSON.stringify(products.map(p => p.id)));
    formData.append("barcodeValue", barcodeValue);
    
    console.log(`[EditBarcode] Submitting bulk edit for ${products.length} products with barcode value: "${barcodeValue}"`);
    submit(formData, { method: "post" });
  };

  return (
    <BlockStack gap="500">

      {/* Progress Indicator */}
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone="success">Step 1 of 2</Badge>
          <ProgressBar progress={50} tone="success" />
        </InlineStack>
      </BlockStack>
      
      {/* Filter Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={FilterIcon} tone="success" />
              <Text variant="headingSm" as="h2">Filter Products</Text>
            </InlineStack>
            <Button
              icon={ResetIcon}
              onClick={handleClearFilters}
              disabled={!hasSearched}
              tone="success"
            >
              Clear filters
            </Button>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <InlineStack gap="300" align="start" blockAlign="center">
              <Select
                label=""
                options={fieldOptions}
                value={selectedField}
                onChange={handleFieldChange}
              />
              <Select
                label=""
                options={
                  selectedField === 'description' 
                    ? descriptionConditionOptions 
                    : selectedField === 'productId'
                      ? productIdConditionOptions
                      : baseConditionOptions
                }
                value={selectedCondition}
                onChange={setSelectedCondition}
              />
              {selectedCondition !== 'empty' && (
                <div style={{ minWidth: '200px' }}>
                  <TextField
                    label=""
                    value={filterValue}
                    onChange={setFilterValue}
                    autoComplete="off"
                    placeholder="Enter search text..."
                  />
                </div>
              )}
            </InlineStack>

            <InlineStack gap="300">
              <Button variant="primary" onClick={handlePreview} loading={isLoading} tone="success">
                Preview matching products
              </Button>
            </InlineStack>

            {/* Display Product Table */}
            {hasSearched && (
              <BlockStack gap="400">
                {isLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <Spinner size="large" />
                  </div>
                ) : products.length === 0 ? (
                  <Banner title="No products found" tone="warning">
                    <p>No products match your filter criteria. Try adjusting your filters.</p>
                  </Banner>
                ) : (
                  <BlockStack gap="300">
                    <Text variant="bodySm" as="p" fontWeight="semibold">
                      {products.length} {products.length === 1 ? 'product' : 'products'} found
                    </Text>
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                      headings={['Product', 'Description', 'Type', 'Barcode', 'Status', 'Price']}
                      rows={rows}
                    />
                    {products.length > itemsPerPage && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                        <Pagination
                          label={`${currentPage} of ${totalPages}`}
                          hasPrevious={currentPage > 1}
                          onPrevious={() => setCurrentPage(currentPage - 1)}
                          hasNext={currentPage < totalPages}
                          onNext={() => setCurrentPage(currentPage + 1)}
                        />
                      </div>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            )}
          </BlockStack>
        </BlockStack>
      </Card>

      {/* Progress Indicator for Step 2 */}
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone="success">Step 2 of 2</Badge>
          <ProgressBar progress={100} tone="success" />
        </InlineStack>
      </BlockStack>

      {/* Edit Product Barcode Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={BarcodeIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Product Barcode</Text>
            </InlineStack>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <div style={{ maxWidth: '400px' }}>
              <TextField
                label="Update Barcode to"
                value={barcodeValue}
                onChange={setBarcodeValue}
                autoComplete="off"
                placeholder="Enter updated barcode..."
              />
            </div>
            
            <Button 
              variant="primary" 
              onClick={handleBulkEdit} 
              tone="success"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Start bulk edit now
            </Button>
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export default EditBarcode; 