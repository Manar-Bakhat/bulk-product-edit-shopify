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
  Divider,
  Checkbox
} from "@shopify/polaris";
import { FilterIcon, ResetIcon, EditIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
import Swal from 'sweetalert2';

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
  success?: boolean;
}

/**
 * EditPrice Component
 * Main component for product filtering and price editing preparation
 */
export function EditPrice() {
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

  // State for price editing
  const [selectedEditOption, setSelectedEditOption] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [setCompareAtPriceToOriginal, setSetCompareAtPriceToOriginal] = useState(false);
  
  // Remix hooks for form submission and data handling
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();

  // Reset all states on mount
  useEffect(() => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
    setCurrentPage(1);
    setSelectedEditOption('');
    setNewPrice('');
    setAdjustmentType('');
    setAdjustmentAmount('');
    setSetCompareAtPriceToOriginal(false);
  }, []); // Empty dependency array means this runs once on mount

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

  // Price editing options
  const editOptions = [
    { label: 'Set price to', value: 'setPrice' },
    { label: 'Set compare-at price to', value: 'setCompareAtPrice' },
    { label: 'Adjust price by amount', value: 'adjustPrice' },
    { label: 'Adjust price by percentage', value: 'adjustPriceByPercentage' },
    { label: 'Adjust compare-at price by amount', value: 'adjustCompareAtPrice' },
    { label: 'Adjust compare-at price by percentage', value: 'adjustCompareAtPriceByPercentage' }
  ];

  // Adjustment type options
  const adjustmentTypeOptions = [
    { label: 'Increase', value: 'increase' },
    { label: 'Decrease', value: 'decrease' }
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
    formData.append("section", "price");
    formData.append("currentSection", currentSection || "price");
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

  /**
   * Handles bulk price editing
   * Submits edit criteria to the server
   */
  const handleBulkEdit = () => {
    console.log('[EditPrice] Starting bulk edit process');
    
    // Check if products have been filtered first
    if (!hasSearched || products.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'Please filter and preview products first before starting bulk edit',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Validate price input based on edit type
    if (selectedEditOption === 'adjustPrice' || selectedEditOption === 'adjustCompareAtPrice') {
      const amount = parseFloat(adjustmentAmount);
      if (isNaN(amount) || amount <= 0) {
        console.log('[EditPrice] Invalid adjustment amount:', adjustmentAmount);
        Swal.fire({
          title: 'Error',
          text: 'Please enter a valid adjustment amount',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }
    } else if (selectedEditOption === 'adjustPriceByPercentage' || selectedEditOption === 'adjustCompareAtPriceByPercentage') {
      if (!adjustmentType) {
        console.log('[EditPrice] No adjustment type selected');
        Swal.fire({
          title: 'Error',
          text: 'Please select whether to increase or decrease the price',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }

      const percentage = parseFloat(adjustmentAmount);
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        console.log('[EditPrice] Invalid percentage:', adjustmentAmount);
        Swal.fire({
          title: 'Error',
          text: 'Please enter a valid percentage between 0 and 100',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }
    } else {
      const price = parseFloat(newPrice);
      if (isNaN(price) || price < 0) {
        console.log('[EditPrice] Invalid price input:', newPrice);
        Swal.fire({
          title: 'Error',
          text: 'Please enter a valid price',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }
    }

    const productIds = products.map(product => product.id);
    const productPrices = products.reduce((acc, product) => {
      acc[product.id] = product.priceRangeV2.minVariantPrice.amount;
      return acc;
    }, {} as Record<string, string>);

    console.log('[EditPrice] Preparing form data:', {
      productIds,
      productPrices,
      newPrice,
      selectedEditOption,
      adjustmentType,
      adjustmentAmount,
      setCompareAtPriceToOriginal
    });

    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "price");
    formData.append("productIds", JSON.stringify(productIds));
    formData.append("productPrices", JSON.stringify(productPrices));
    formData.append("newPrice", newPrice);
    formData.append("editType", selectedEditOption);
    
    if (selectedEditOption === 'adjustPrice' || selectedEditOption === 'adjustCompareAtPrice' || selectedEditOption === 'adjustPriceByPercentage' || selectedEditOption === 'adjustCompareAtPriceByPercentage') {
      formData.append("adjustmentType", adjustmentType);
      formData.append("adjustmentAmount", adjustmentAmount);
      formData.append("setCompareAtPriceToOriginal", setCompareAtPriceToOriginal.toString());
    }

    // Log the actual form data being sent
    console.log('[EditPrice] Form data being sent:', {
      actionType: formData.get("actionType"),
      section: formData.get("section"),
      productIds: formData.get("productIds"),
      productPrices: formData.get("productPrices"),
      newPrice: formData.get("newPrice"),
      editType: formData.get("editType"),
      adjustmentType: formData.get("adjustmentType"),
      adjustmentAmount: formData.get("adjustmentAmount"),
      setCompareAtPriceToOriginal: formData.get("setCompareAtPriceToOriginal")
    });

    console.log('[EditPrice] Submitting form data...');
    submit(formData, { method: "post" });
  };

  /**
   * Effect to handle successful bulk edit
   * Shows success message and resets form
   */
  useEffect(() => {
    if (actionData) {
      console.log('[EditPrice] Received action data:', actionData);
      
      if (actionData.success) {
        console.log('[EditPrice] Bulk edit successful!');
        // Reset form fields
        setSelectedEditOption('');
        setNewPrice('');
        setAdjustmentType('');
        setAdjustmentAmount('');
        setSetCompareAtPriceToOriginal(false);

        // Show success message
        Swal.fire({
          title: 'Success!',
          text: 'Product prices updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else if (actionData.error) {
        console.error('[EditPrice] Bulk edit failed:', actionData.error);
        Swal.fire({
          title: 'Error',
          text: actionData.error,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  }, [actionData]);

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

       {/* Progress Indicator for Step 2 */}
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Badge tone="success">Step 2 of 2</Badge>
          <ProgressBar progress={100} tone="success" />
        </InlineStack>
      </BlockStack>

      {/* Edit Section */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Icon source={EditIcon} tone="success" />
              <Text variant="headingSm" as="h2">Edit Prices</Text>
            </InlineStack>
          </InlineStack>
          <Divider />

          <BlockStack gap="400">
            <Select
              label=""
              options={editOptions}
              value={selectedEditOption}
              onChange={setSelectedEditOption}
              placeholder="Select an option"
            />
            
            {selectedEditOption === 'setPrice' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Set Price To</Text>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    type="number"
                    value={newPrice}
                    onChange={setNewPrice}
                    placeholder="Enter new price"
                    autoComplete="off"
                    prefix="$"
                  />
                </div>
                <Button variant="primary" onClick={handleBulkEdit} tone="success">
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}

            {selectedEditOption === 'setCompareAtPrice' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Set Compare-at Price To</Text>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    type="number"
                    value={newPrice}
                    onChange={setNewPrice}
                    placeholder="Enter new compare-at price"
                    autoComplete="off"
                    prefix="$"
                  />
                </div>
                <Button variant="primary" onClick={handleBulkEdit} tone="success">
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}

            {selectedEditOption === 'adjustPrice' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Adjust Price By Amount</Text>
                <div style={{ maxWidth: '400px' }}>
                  <Select
                    label=""
                    options={adjustmentTypeOptions}
                    value={adjustmentType}
                    onChange={setAdjustmentType}
                    placeholder="Select adjustment type"
                  />
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    type="number"
                    value={adjustmentAmount}
                    onChange={setAdjustmentAmount}
                    placeholder="Enter adjustment amount"
                    autoComplete="off"
                    prefix="$"
                  />
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <Checkbox
                    label="When completed, set compare-at-price to original price"
                    checked={setCompareAtPriceToOriginal}
                    onChange={setSetCompareAtPriceToOriginal}
                    helpText="This will set the compare-at-price to the original price before the adjustment"
                  />
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleBulkEdit} 
                  tone="success"
                  disabled={!adjustmentType || !adjustmentAmount}
                >
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}

            {selectedEditOption === 'adjustCompareAtPrice' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Adjust Compare-at Price By Amount</Text>
                <div style={{ maxWidth: '400px' }}>
                  <Select
                    label=""
                    options={adjustmentTypeOptions}
                    value={adjustmentType}
                    onChange={setAdjustmentType}
                    placeholder="Select adjustment type"
                  />
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    type="number"
                    value={adjustmentAmount}
                    onChange={setAdjustmentAmount}
                    placeholder="Enter adjustment amount"
                    autoComplete="off"
                    prefix="$"
                  />
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleBulkEdit} 
                  tone="success"
                  disabled={!adjustmentType || !adjustmentAmount}
                >
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}

            {selectedEditOption === 'adjustPriceByPercentage' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Adjust Price By Percentage</Text>
                <div style={{ maxWidth: '400px' }}>
                  <Select
                    label=""
                    options={adjustmentTypeOptions}
                    value={adjustmentType}
                    onChange={setAdjustmentType}
                    placeholder="Select adjustment type"
                  />
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    type="number"
                    value={adjustmentAmount}
                    onChange={setAdjustmentAmount}
                    placeholder="Enter percentage (0-100)"
                    autoComplete="off"
                    suffix="%"
                  />
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <Checkbox
                    label="When completed, set compare-at-price to original price"
                    checked={setCompareAtPriceToOriginal}
                    onChange={setSetCompareAtPriceToOriginal}
                    helpText="This will set the compare-at-price to the original price before the adjustment"
                  />
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleBulkEdit} 
                  tone="success"
                  disabled={!adjustmentType || !adjustmentAmount}
                >
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}

            {selectedEditOption === 'adjustCompareAtPriceByPercentage' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Adjust Compare-at Price By Percentage</Text>
                <div style={{ maxWidth: '400px' }}>
                  <Select
                    label=""
                    options={adjustmentTypeOptions}
                    value={adjustmentType}
                    onChange={setAdjustmentType}
                    placeholder="Select adjustment type"
                  />
                </div>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    type="number"
                    value={adjustmentAmount}
                    onChange={setAdjustmentAmount}
                    placeholder="Enter percentage (0-100)"
                    autoComplete="off"
                    suffix="%"
                  />
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleBulkEdit} 
                  tone="success"
                  disabled={!adjustmentType || !adjustmentAmount}
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