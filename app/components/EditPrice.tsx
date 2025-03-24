/**
 * EditPrice Component
 * This component handles bulk editing of product prices.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Navigate to Shopify Admin and Online Store
 * 
 * @author Manar Bakhat
 */

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
import { FilterIcon, ResetIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData } from "@remix-run/react";

/**
 * Product interface defining the structure of product data
 * Used for type safety and data handling throughout the component
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
}

/**
 * ActionData interface for handling API responses
 * Used to type the response data from the server
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
}

/**
 * EditPrice Component
 * Main component for product filtering and price editing preparation
 */
export function EditPrice() {
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

  /**
   * Effect to handle filtered products from the server
   * Updates the products state when new data is received
   */
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
          priceRangeV2: node.priceRangeV2
        }));
        setProducts(filteredProducts);
        setHasSearched(true);
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Calculate pagination values
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

  /**
   * Generates table rows for the products data table
   * Each row includes product image, title, vendor, and action buttons
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
        {/* 
        <InlineStack gap="200" blockAlign="center">
          <Button
            size="slim"
            tone="success"
            onClick={() => window.open(`/admin/products/${product.id}`, '_blank')}
          >
            Go to Shopify Admin
          </Button>
          <Button
            size="slim"
            tone="success"
            onClick={() => window.open(`/admin/online-store/products/${product.id}`, '_blank')}
          >
            Go to Online Store
          </Button>
        </InlineStack>
        */}
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
   * Updates condition options based on selected field
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
   * Submits filter criteria to the server
   */
  const handlePreview = () => {
    setIsLoading(true);
    setHasSearched(true);
    const formData = new FormData();
    formData.append("field", selectedField);
    formData.append("condition", selectedCondition);
    formData.append("value", filterValue);
    submit(formData, { method: "post" });
  };

  /**
   * Handles filter reset
   * Clears all filter states and resets to initial values
   */
  const handleClearFilters = () => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
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
                      columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                      headings={['Product', 'Description', 'Product Type', 'Status', 'Price']}
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
    </BlockStack>
  );
} 