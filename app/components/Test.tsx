/**
 * EditVariantWeight Component
 * This component handles bulk editing of product variant weights.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit product variant weights in bulk
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
import { FilterIcon, ResetIcon, ProductIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData } from "@remix-run/react";
import Swal from 'sweetalert2';

interface Product {
  id: string | number;
  title: string;
  description: string;
  productType: string;
  vendor?: string;
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
  variant_details?: Array<{
    id: string | number;
    weight: number | string | null;
    weight_unit: string;
  }>;
  variants?: {
    edges: Array<{
      node: {
        id?: string;
        title?: string;
        inventoryItem?: {
          measurement?: {
            weight?: {
              value: string | number;
              unit: string;
            };
          };
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
  partialFailure?: boolean;
  message?: string;
  details?: string;
  results?: Array<{
    productId: string;
    productTitle: string;
    variantUpdates: Array<{
      variantId: string;
      originalWeight: string;
      originalWeightUnit: string;
      newWeight: string;
      newWeightUnit: string;
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

function test() {
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
  
  // Weight editing options
  const [weightUnit, setWeightUnit] = useState('g');
  const [weightValue, setWeightValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editMode, setEditMode] = useState('');

  // Handle filtered products
  useEffect(() => {
    if (actionData) {
      if (actionData.data?.rest_products) {
        console.log('[Test] Processing REST API products');
        
        try {
          // Type explicitly as Product[]
          const restProducts: Product[] = actionData.data.rest_products
            .map((product: any) => {
              if (!product) {
                console.warn('[Test] Null product in REST response');
                return null;
              }
              
              return {
                id: product.id.toString(),
                title: product.title || 'Unnamed product',
                vendor: product.vendor || '',
                status: product.status?.toUpperCase() || 'ACTIVE',
                featuredImage: product.image ? {
                  url: product.image.src,
                  altText: product.image.alt || ''
                } : undefined,
                variant_details: Array.isArray(product.variant_details) ? product.variant_details : []
              } as Product;
            })
            .filter((p): p is Product => p !== null);
          
          setProducts(restProducts);
          setHasSearched(true);
          
          // Log weight information for debugging
          restProducts.forEach(product => {
            if (product.variant_details && product.variant_details.length > 0) {
              console.log(`[Test] Product ${product.title} has ${product.variant_details.length} variants with weights:`, 
                JSON.stringify(product.variant_details, null, 2));
            } else {
              console.log(`[Test] Product ${product.title} has no variant weight details`);
            }
          });
          showToast(`${restProducts.length} products loaded successfully`, false);
        } catch (error) {
          console.error('[Test] Error processing REST data:', error);
          showToast("Error processing product data", true);
        }
      } 
      // Fallback to GraphQL (should not be used anymore)
      else if (actionData.data?.products?.edges) {
        console.log('[Test] Using GraphQL products data - please use REST API instead');
        
        try {
          const filteredProducts = actionData.data.products.edges.map(({ node }: any) => {
            return {
              id: typeof node.id === 'string' ? node.id.replace('gid://shopify/Product/', '') : node.id.toString(),
              title: node.title || 'Unnamed product',
              vendor: node.vendor || '',
              status: node.status || 'ACTIVE',
              featuredImage: node.featuredImage,
              variant_details: node.variant_details,
              variants: node.variants
            } as Product;
          });
          
          setProducts(filteredProducts);
          setHasSearched(true);
          showToast(`${filteredProducts.length} products loaded successfully`, false);
        } catch (error) {
          console.error('[Test] Error processing GraphQL data:', error);
          showToast("Error processing product data", true);
        }
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Handle action data response for success/error
  useEffect(() => {
    if (actionData) {
      console.log('[EditVariantWeight] Received action data:', actionData);
      setIsSubmitting(false);
      
      if (actionData.success) {
        console.log('[EditVariantWeight] Bulk edit successful!');
        
        // Réinitialiser le formulaire en cas de succès
        setEditMode('');
        setWeightValue('');
        
        // Show success message
        Swal.fire({
          title: 'Success!',
          text: actionData.message || 'Variant weight updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      } else if (actionData.error) {
        console.error('[EditVariantWeight] Bulk edit failed:', actionData.error);
        
        // Show error message
        Swal.fire({
          title: 'Error',
          text: actionData.error,
          icon: 'error',
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

  // Generate rows for the DataTable
  const rows = currentProducts.map((product) => {
    // Gather all variant weights
    const variantWeights: Array<{weight: string, unit: string}> = [];
    
    // Extract weights from REST API data
    if (product.variant_details && product.variant_details.length > 0) {
      product.variant_details.forEach(variant => {
        if (variant.weight !== null && variant.weight !== undefined) {
          variantWeights.push({
            weight: variant.weight.toString(),
            unit: variant.weight_unit || 'g'
          });
        }
      });
    } 
    // Extract weights from GraphQL data
    else if (product.variants && product.variants.edges) {
      product.variants.edges.forEach(edge => {
        const variant = edge.node;
        if (variant.inventoryItem?.measurement?.weight) {
          const weight = variant.inventoryItem.measurement.weight.value;
          let unit = variant.inventoryItem.measurement.weight.unit.toLowerCase();
          
          // Normalize unit for display
          switch (unit) {
            case 'grams':
              unit = 'g';
              break;
            case 'kilograms':
              unit = 'kg';
              break;
            case 'ounces':
              unit = 'oz';
              break;
            case 'pounds':
              unit = 'lb';
              break;
          }
          
          variantWeights.push({
            weight: weight.toString(),
            unit: unit
          });
        }
      });
    }
    
    // Create weight display text
    const weightDisplay = variantWeights.length > 0 
      ? variantWeights.map(w => `${w.weight} ${w.unit}`).join(', ')
      : '-- g';

    return [
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
        <Text variant="bodySm" as="p">{weightDisplay}</Text>
      </div>
    ];
  });

  const fieldOptions = [
    { label: 'Title', value: 'title' },
    { label: 'Description', value: 'description' },
    { label: 'Product ID', value: 'productId' }
  ];

  const weightUnitOptions = [
    { label: 'Grams', value: 'g' },
    { label: 'Kilograms', value: 'kg' },
    { label: 'Ounces', value: 'oz' },
    { label: 'Pounds', value: 'lb' }
  ];

  const editModeOptions = [
    { label: 'Update variant weight unit', value: 'weightUnit' },
    { label: 'Update variant weight', value: 'weight' }
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

    // Validate edit mode is selected
    if (!editMode) {
      Swal.fire({
        title: 'Error',
        text: 'Please select an edit mode option before continuing.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    // Validate inputs based on edit mode
    if (editMode === 'weight' && (!weightValue || isNaN(Number(weightValue)) || Number(weightValue) < 0)) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a valid weight value (must be a positive number).',
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
    formData.append("section", "variantWeight");
    formData.append("productIds", JSON.stringify(products.map(p => p.id)));
    formData.append("useRestApi", "true"); // Force l'utilisation de l'API REST pour éviter les erreurs GraphQL
    
    if (editMode === 'weight') {
      formData.append("weightValue", weightValue);
    }
    
    // Ajouter l'unité de poids seulement en mode weightUnit, ou utiliser 'g' par défaut en mode weight
    formData.append("weightUnit", editMode === 'weightUnit' ? weightUnit : 'g');
    
    console.log(`[EditVariantWeight] Submitting bulk edit for ${products.length} products`);
    if (editMode === 'weightUnit') {
      console.log(`[EditVariantWeight] Using weight unit: ${weightUnit}`);
    } else {
      console.log(`[EditVariantWeight] Using weight value: ${weightValue}`);
    }
    
    submit(formData, { method: "post" });
  };

  // Handle bulk edit button disable state based on selection
  const isBulkEditDisabled = isSubmitting || 
    !editMode || 
    (editMode === 'weight' && !weightValue);

  return (
    <BlockStack gap="500">
      
      {/* Filter Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={FilterIcon} tone="success" />
              <Text variant="headingSm" as="h2">Filter Products</Text>
            </InlineStack>
            <Button variant="plain" onClick={handleClearFilters} icon={ResetIcon}>
              Reset filters
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
                      headings={['Product', 'Description', 'Type', 'Status', 'Price', 'Weight']}
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

      {/* Edit Variant Weight Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={ProductIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Variant Weight</Text>
            </InlineStack>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <div style={{ maxWidth: '800px', width: '100%' }}>
              <Select
                label=""
                options={editModeOptions}
                value={editMode}
                onChange={setEditMode}
                placeholder="Select an option"
              />
            </div>
            
            {editMode && (
              <BlockStack gap="400">
                <div style={{ maxWidth: '800px', width: '100%' }}>
                  {editMode === 'weight' ? (
                    <TextField
                      label="Update Weight Value to"
                      type="number"
                      value={weightValue}
                      onChange={setWeightValue}
                      min="0"
                      step={0.01}
                      autoComplete="off"
                    />
                  ) : (
                    <Select
                      label="Update Weight Unit to"
                      options={weightUnitOptions}
                      value={weightUnit}
                      onChange={setWeightUnit}
                    />
                  )}
                </div>
                
                <Button 
                  variant="primary" 
                  onClick={handleBulkEdit} 
                  tone="success"
                  disabled={isSubmitting || (editMode === 'weight' && !weightValue)}
                  loading={isSubmitting}
                >
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export default test; 