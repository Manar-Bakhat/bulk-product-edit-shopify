/**
 * EditCostPerItem Component
 * This component handles bulk editing of product item costs.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit cost per item in bulk
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
import { FilterIcon, ResetIcon, MoneyIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import Swal from 'sweetalert2';

/**
 * Product interface defining the structure of product data
 */
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
  inventoryItem?: {
    unitCost?: {
      amount: string;
      currencyCode: string;
    }
  };
}

/**
 * ActionData interface for handling API responses
 */
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
  partialFailure?: boolean;
}

function EditCostPerItem() {
  const [searchParams] = useSearchParams();
  const currentSection = searchParams.get("section");

  // State for filtering
  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  
  // State for products and UI
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Remix hooks for form submission and data handling
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();

  // State for cost editing
  const [costValue, setCostValue] = useState('');

  // Reset all states on mount
  useEffect(() => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
    setCurrentPage(1);
    setCostValue('');
  }, []);

  /**
   * Effect to handle filtered products from the server
   */
  useEffect(() => {
    if (actionData) {
      if (actionData.data?.products?.edges) {
        const filteredProducts = actionData.data.products.edges.map(({ node }) => {
          // Get the first variant's inventory item if it exists
          const firstVariant = node.variants?.edges?.[0]?.node;
          const inventoryItem = firstVariant?.inventoryItem;

          return {
            id: node.id.replace('gid://shopify/Product/', ''),
            title: node.title,
            description: node.description,
            productType: node.productType,
            vendor: node.vendor,
            status: node.status,
            featuredImage: node.featuredImage,
            priceRangeV2: node.priceRangeV2,
            inventoryItem: inventoryItem || undefined
          };
        });
        setProducts(filteredProducts);
        setHasSearched(true);
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Handle action data responses (success/error)
  useEffect(() => {
    if (actionData) {
      console.log('[EditCostPerItem] Action data received:', actionData);
      
      if (actionData.success) {
        Swal.fire({
          title: 'Success',
          text: actionData.message || 'Cost per item updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        
        // Reset cost value after successful update
        setCostValue('');
      } else if (actionData.error) {
        // Check for permissions error
        if (actionData.error.includes('write_inventory scope')) {
          Swal.fire({
            title: 'Permission Required',
            html: 
              'Your app needs additional permissions to edit inventory costs.<br/><br/>' +
              'Please contact your administrator to update the app permissions and add the <strong>write_inventory</strong> scope.',
            icon: 'warning',
            confirmButtonText: 'OK',
            confirmButtonColor: "#008060"
          });
        } else {
          // Determine if it's a partial failure or complete failure
          const errorIcon = actionData.partialFailure ? 'warning' : 'error';
          
          Swal.fire({
            title: actionData.partialFailure ? 'Partial Success' : 'Error',
            text: actionData.error,
            icon: errorIcon,
            confirmButtonText: 'OK',
            confirmButtonColor: "#008060"
          });
        }
      } else if (actionData.data?.products?.edges) {
        // This is just a product search result, don't show any message
        console.log('[EditCostPerItem] Products loaded for preview');
      }
    }
  }, [actionData]);

  // Calculate pagination values
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  /**
   * Generates table rows for the products data table
   */
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
    <div style={{ textAlign: 'right' }}>
      <Text variant="bodyMd" as="p" fontWeight="semibold">
        {product.inventoryItem?.unitCost 
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: product.inventoryItem.unitCost.currencyCode
            }).format(parseFloat(product.inventoryItem.unitCost.amount))
          : 'Not set'}
      </Text>
    </div>
  ]);

  // Filter options configuration
  const fieldOptions = [
    { label: 'Title', value: 'title' },
    { label: 'Description', value: 'description' },
    { label: 'Product ID', value: 'productId' }
  ];

  const baseConditionOptions = [
    { label: 'is', value: 'is' },
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
  ];

  const productIdConditionOptions = [
    { label: 'is', value: 'is' }
  ];

  const descriptionConditionOptions = [
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
    { label: 'empty', value: 'empty' }
  ];

  /**
   * Handles field selection changes
   */
  const handleFieldChange = (value: string) => {
    setSelectedField(value);
    if (value === 'description' && selectedCondition === 'is') {
      setSelectedCondition('contains');
    }
    if (value === 'productId') {
      setSelectedCondition('is');
    }
  };

  /**
   * Handles product preview request
   */
  const handlePreview = () => {
    setIsLoading(true);
    setHasSearched(true);
    const formData = new FormData();
    formData.append("field", selectedField);
    formData.append("condition", selectedCondition);
    formData.append("value", filterValue);
    formData.append("section", "costPerItem");
    formData.append("currentSection", currentSection || "costPerItem");
    submit(formData, { method: "post" });
  };

  /**
   * Handles filter reset
   */
  const handleClearFilters = () => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
  };

  /**
   * Handles bulk cost editing
   */
  const handleBulkEdit = () => {
    console.log('[EditCostPerItem] Starting bulk edit process');
    
    // Check if products have been filtered first
    if (!hasSearched || products.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'Please filter and preview products first before starting bulk edit',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }
    
    // Validate cost input
    if (!costValue) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a cost value',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    const cost = parseFloat(costValue);
    if (isNaN(cost) || cost < 0) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter a valid cost value',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    // Prepare form data
    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("action", "updateCost");
    formData.append("costValue", costValue);
    formData.append("section", "costPerItem");
    formData.append("currentSection", currentSection || "costPerItem");
    formData.append("productIds", JSON.stringify(products.map(product => product.id.split("/").pop())));
    
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
                      headings={['Product', 'Description', 'Type', 'Status', 'Price', 'Cost per item']}
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

      {/* Edit Cost Per Item Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={MoneyIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Cost Per Item</Text>
            </InlineStack>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <div style={{ maxWidth: "300px" }}>
              <TextField
                label="Update cost per item to"
                type="number"
                value={costValue}
                onChange={setCostValue}
                autoComplete="off"
                prefix="$"
                placeholder="Enter new cost value..."
              />
            </div>

            <InlineStack gap="300">
              <Button 
                variant="primary" 
                onClick={handleBulkEdit} 
                disabled={!costValue}
                tone="success"
                size="large"
                fullWidth
              >
                Start bulk edit now
              </Button>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export default EditCostPerItem; 