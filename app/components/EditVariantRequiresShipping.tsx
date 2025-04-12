/**
 * EditVariantRequiresShipping Component
 * This component handles bulk editing of product variant shipping requirements.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit requires shipping setting in bulk
 * 
 * @author Manar Bakhat
 */

import React, { useState, useEffect } from "react";
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
import { FilterIcon, ResetIcon, GlobeIcon } from '@shopify/polaris-icons';
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
        id: string;
        title: string;
        inventoryItem?: {
          id: string;
          requiresShipping: boolean;
        };
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
  message?: string;
}

function EditVariantRequiresShipping() {
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
  const [requiresShipping, setRequiresShipping] = useState('true');
  // Track which products have been modified
  const [modifiedProducts, setModifiedProducts] = useState<{[key: string]: boolean}>({});

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
          variants: node.variants // Make sure to include the variants data
        }));
        setProducts(filteredProducts);
        setHasSearched(true);
        
        // More detailed debug log to check shipping status
        console.log('[EditVariantRequiresShipping] Filtered products with shipping status:', 
          filteredProducts.map(p => ({
            id: p.id,
            title: p.title,
            hasVariants: !!p.variants,
            variantCount: p.variants?.edges?.length || 0,
            firstVariant: p.variants?.edges?.[0]?.node,
            inventoryItem: p.variants?.edges?.[0]?.node?.inventoryItem,
            requiresShipping: p.variants?.edges?.[0]?.node?.inventoryItem?.requiresShipping
          }))
        );
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Reset form after submission
  const resetForm = () => {
    setRequiresShipping(''); // Clear the selection
  };

  // Handle action data response for success/error
  useEffect(() => {
    if (actionData) {
      console.log('[EditVariantRequiresShipping] Received action data:', actionData);
      setIsLoading(false);
      
      if (actionData.success) {
        console.log('[EditVariantRequiresShipping] Bulk edit successful!');
        
        // Record which products were updated and their new shipping status value
        const updatedProductIds = products.map(p => p.id);
        const newRequiresShipping = requiresShipping === 'true';
        
        // Update our local tracking of modified products
        const updates = {} as {[key: string]: boolean};
        updatedProductIds.forEach(id => {
          updates[id] = newRequiresShipping;
        });
        
        setModifiedProducts(prev => ({
          ...prev,
          ...updates
        }));
        
        // Reset form fields
        resetForm();
        
        // Show success message
        Swal.fire({
          title: 'Success!',
          text: actionData.message || 'Shipping requirements updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      } else if (actionData.error) {
        console.error('[EditVariantRequiresShipping] Bulk edit failed:', actionData.error);
        Swal.fire({
          title: 'Error',
          text: actionData.error,
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      }
    }
  }, [actionData, products, requiresShipping]);

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
    </div>,
    <div>
      {/* Extract shipping requirement status, defaulting to "Unknown" if not available */}
      {(() => {
        // Check if this product has been modified by recent bulk edit
        if (product.id in modifiedProducts) {
          const updatedValue = modifiedProducts[product.id];
          return (
            <Badge tone={updatedValue ? 'success' : 'critical'}>
              {updatedValue ? 'Yes' : 'No'}
            </Badge>
          );
        }
        
        // If not modified, get requires shipping status from variants
        const variantNode = product.variants?.edges?.[0]?.node;
        const requiresShippingValue = variantNode?.inventoryItem?.requiresShipping;
        
        // If we have a definite true/false value
        if (requiresShippingValue === true) {
          return (
            <Badge tone="success">Yes</Badge>
          );
        } else if (requiresShippingValue === false) {
          return (
            <Badge tone="critical">No</Badge>
          );
        }
        
        // If no data is available
        return <Text variant="bodySm" tone="subdued" as="p">Unknown</Text>;
      })()}
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

  // Requires shipping options
  const requiresShippingOptions = [
    { label: 'Yes (Requires shipping)', value: 'true' },
    { label: 'No (Does not require shipping)', value: 'false' }
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

    if (!requiresShipping) {
      // Show an error if no option is selected
      Swal.fire({
        title: 'Error',
        text: 'Please select a shipping requirement option.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    // Submit form logic immediately without confirmation
    console.log('Starting bulk edit for shipping requirements:', {
      requiresShipping,
      products: products.map(p => p.id)
    });

    setIsLoading(true);
    
    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "variantRequiresShipping");
    formData.append("productIds", JSON.stringify(products.map(p => p.id)));
    formData.append("requiresShipping", requiresShipping);
    
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

            {hasSearched && (
              <div style={{ position: 'relative' }}>
                {isLoading && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'var(--p-color-bg-surface)',
                    opacity: 0.8,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1
                  }}>
                    <Spinner size="large" />
                  </div>
                )}
                
                {products.length > 0 ? (
                  <BlockStack gap="400">
                    <DataTable
                      columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                      headings={['Product', 'Description', 'Product Type', 'Status', 'Price', 'Requires Shipping']}
                      rows={rows}
                      hoverable
                      defaultSortDirection="descending"
                      initialSortColumnIndex={0}
                    />
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                      <Pagination
                        label={`Page ${currentPage} of ${totalPages}`}
                        hasPrevious={currentPage > 1}
                        onPrevious={() => setCurrentPage(currentPage - 1)}
                        hasNext={currentPage < totalPages}
                        onNext={() => setCurrentPage(currentPage + 1)}
                      />
                    </div>
                  </BlockStack>
                ) : !isLoading && (
                  <Banner tone="success">
                    No products found matching your criteria
                  </Banner>
                )}
              </div>
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

      {/* Edit Shipping Requirements Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={GlobeIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Shipping Requirements</Text>
            </InlineStack>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <div style={{ maxWidth: '650px' }}>
              <BlockStack gap="200">
                <Text as="p" variant="headingMd">
                  Set shipping requirement status
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Choose whether these product variants require shipping. Products that require shipping will need a shipping method
                  and address at checkout, while products that don't require shipping (like digital goods) won't.
                </Text>

                <div style={{ marginTop: '12px' }}>
                  <Select
                    label="Requires Shipping"
                    options={requiresShippingOptions}
                    value={requiresShipping}
                    onChange={setRequiresShipping}
                    helpText="This setting will be applied to all variants of the selected products."
                    placeholder="Select an option"
                  />
                </div>
              </BlockStack>
            </div>
            
            <InlineStack gap="400" blockAlign="center">
              <Button 
                variant="primary" 
                onClick={handleBulkEdit} 
                tone="success"
                disabled={isLoading}
              >
                Start bulk edit now
              </Button>
              
              {requiresShipping && (
                <Text variant="bodySm" as="p">
                  Selected option: <strong>{requiresShipping === 'true' ? 'Requires shipping' : 'Does not require shipping'}</strong>
                </Text>
              )}
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    
    </BlockStack>
  );
}

export default EditVariantRequiresShipping; 