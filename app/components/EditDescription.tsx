/**
 * EditDescription Component
 * This component handles bulk editing of product descriptions.
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
import Swal from "sweetalert2";

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

export function EditDescription() {
  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [descriptionPosition, setDescriptionPosition] = useState('');
  const [textToAdd, setTextToAdd] = useState('');
  const [textToRemove, setTextToRemove] = useState('');
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

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
          priceRangeV2: node.priceRangeV2
        }));
        setProducts(filteredProducts);
        setHasSearched(true);
      }
      setIsLoading(false);
    }
  }, [actionData]);

  // Add useEffect to handle successful updates
  useEffect(() => {
    if (actionData) {
      console.log('Action data received:', actionData);
      
      if (actionData.success) {
        // Only reset step 2 fields (description editing)
        setTextToAdd('');
        setTextToRemove('');
        setDescriptionPosition('');
        
        // Show success message
        Swal.fire({
          title: "Success!",
          text: `Successfully updated ${products.length} product descriptions`,
          icon: "success",
          confirmButtonText: "OK",
          confirmButtonColor: "#008060"
        });
      } else if (actionData.error) {
        // Show error message
        Swal.fire({
          title: "Error!",
          text: actionData.error,
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#008060"
        });
      }
    }
  }, [actionData, products.length]);

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

  const handleBulkEdit = async () => {
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

    // Validate inputs based on edit type
    if (descriptionPosition === 'remove') {
      if (!textToRemove.trim()) {
        Swal.fire({
          title: 'Error',
          text: 'Please enter text to remove',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        return;
      }

      // Check if text exists in any product description
      const productsWithText = products.filter(product => 
        product.description && product.description.toLowerCase().includes(textToRemove.toLowerCase())
      );

      if (productsWithText.length === 0) {
        Swal.fire({
          title: 'Error',
          text: 'Text not found in any of the filtered products',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        return;
      }

      // If text exists in some products, show confirmation dialog
      if (productsWithText.length < products.length) {
        Swal.fire({
          title: 'Warning',
          text: `The text "${textToRemove}" was found in ${productsWithText.length} out of ${products.length} products. Do you want to continue?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, continue',
          cancelButtonText: 'No, cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            // Continue with the bulk edit
            const productIds = productsWithText.map(product => product.id);
            const productDescriptions = productsWithText.reduce((acc, product) => {
              acc[product.id] = product.description;
              return acc;
            }, {} as Record<string, string>);

            const formData = new FormData();
            formData.append("actionType", "bulkEdit");
            formData.append("section", "description");
            formData.append("productIds", JSON.stringify(productIds));
            formData.append("productDescriptions", JSON.stringify(productDescriptions));
            formData.append("textToRemove", textToRemove);
            formData.append("editType", "remove");
            formData.append("position", descriptionPosition);
            submit(formData, { method: "post" });
          }
        });
        return;
      }
      
      // If text exists in all products, proceed with the removal
      const productIds = products.map(product => product.id);
      const productDescriptions = products.reduce((acc, product) => {
        acc[product.id] = product.description;
        return acc;
      }, {} as Record<string, string>);

      const formData = new FormData();
      formData.append("actionType", "bulkEdit");
      formData.append("section", "description");
      formData.append("productIds", JSON.stringify(productIds));
      formData.append("productDescriptions", JSON.stringify(productDescriptions));
      formData.append("textToRemove", textToRemove);
      formData.append("editType", "remove");
      formData.append("position", descriptionPosition);
      submit(formData, { method: "post" });
      return;
    } else if (descriptionPosition === 'replace') {
      if (!textToRemove.trim() || !textToAdd.trim()) {
        Swal.fire({
          title: 'Error',
          text: 'Please enter both find text and replacement text',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        return;
      }

      // Check if text exists in any product description
      const productsWithText = products.filter(product => 
        product.description && product.description.toLowerCase().includes(textToRemove.toLowerCase())
      );

      if (productsWithText.length === 0) {
        Swal.fire({
          title: 'Error',
          text: 'Text to find not found in any of the filtered products',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        return;
      }

      // If text exists in some products, show confirmation dialog
      if (productsWithText.length < products.length) {
        Swal.fire({
          title: 'Warning',
          text: `The text "${textToRemove}" was found in ${productsWithText.length} out of ${products.length} products. Do you want to continue?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, continue',
          cancelButtonText: 'No, cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            // Continue with the bulk edit
            const productIds = productsWithText.map(product => product.id);
            const productDescriptions = productsWithText.reduce((acc, product) => {
              acc[product.id] = product.description;
              return acc;
            }, {} as Record<string, string>);

            const formData = new FormData();
            formData.append("actionType", "bulkEdit");
            formData.append("section", "description");
            formData.append("productIds", JSON.stringify(productIds));
            formData.append("productDescriptions", JSON.stringify(productDescriptions));
            formData.append("textToRemove", textToRemove);
            formData.append("textToAdd", textToAdd);
            formData.append("editType", "replace");
            formData.append("position", descriptionPosition);
            submit(formData, { method: "post" });
          }
        });
        return;
      }
      
      // If text exists in all products, proceed with the replacement
      const productIds = products.map(product => product.id);
      const productDescriptions = products.reduce((acc, product) => {
        acc[product.id] = product.description;
        return acc;
      }, {} as Record<string, string>);

      const formData = new FormData();
      formData.append("actionType", "bulkEdit");
      formData.append("section", "description");
      formData.append("productIds", JSON.stringify(productIds));
      formData.append("productDescriptions", JSON.stringify(productDescriptions));
      formData.append("textToRemove", textToRemove);
      formData.append("textToAdd", textToAdd);
      formData.append("editType", "replace");
      formData.append("position", descriptionPosition);
      submit(formData, { method: "post" });
      return;
    } else if (!textToAdd.trim()) {
      Swal.fire({
        title: 'Error',
        text: 'Please enter text to add',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: "#008060"
      });
      return;
    }

    const productIds = products.map(product => product.id);
    const productDescriptions = products.reduce((acc, product) => {
      acc[product.id] = product.description;
      return acc;
    }, {} as Record<string, string>);

    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "description");
    formData.append("productIds", JSON.stringify(productIds));
    formData.append("productDescriptions", JSON.stringify(productDescriptions));
    formData.append("textToAdd", textToAdd);
    formData.append("editType", descriptionPosition === "beginning" ? "addBeginning" : "addEnd");
    formData.append("position", descriptionPosition);
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
                placeholder="Select an option"
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

      {/* Description Position Selection */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingSm" as="h2">Select Description Position</Text>
          <Select
            label=""
            options={[
              { label: 'Add text to the beginning of the description', value: 'beginning' },
              { label: 'Add text to the end of the description', value: 'end' },
              { label: 'Find and remove text from description', value: 'remove' },
              { label: 'Find and replace text in description', value: 'replace' }
            ]}
            value={descriptionPosition}
            onChange={setDescriptionPosition}
            placeholder="Select an option"
          />
          
          {descriptionPosition && (
            <BlockStack gap="400">
              {descriptionPosition === 'remove' ? (
                <TextField
                  label="Text to remove"
                  value={textToRemove}
                  onChange={setTextToRemove}
                  multiline={4}
                  autoComplete="off"
                  placeholder="Enter the text you want to remove from the description..."
                />
              ) : descriptionPosition === 'replace' ? (
                <>
                  <TextField
                    label="Find text"
                    value={textToRemove}
                    onChange={setTextToRemove}
                    multiline={4}
                    autoComplete="off"
                    placeholder="Enter the text you want to find in the description..."
                  />
                  <TextField
                    label="Replace with"
                    value={textToAdd}
                    onChange={setTextToAdd}
                    multiline={4}
                    autoComplete="off"
                    placeholder="Enter the replacement text..."
                  />
                </>
              ) : (
                <TextField
                  label={descriptionPosition === 'beginning' ? "Text to add at the beginning" : "Text to add at the end"}
                  value={textToAdd}
                  onChange={setTextToAdd}
                  multiline={4}
                  autoComplete="off"
                  placeholder={`Enter the text you want to add ${descriptionPosition === 'beginning' ? 'at the beginning' : 'to the end'} of the description...`}
                />
              )}
              <Button 
                variant="primary" 
                tone="success"
                onClick={handleBulkEdit}
                disabled={
                  (descriptionPosition === 'remove' && !textToRemove.trim()) || 
                  (descriptionPosition === 'replace' && (!textToRemove.trim() || !textToAdd.trim())) ||
                  ((descriptionPosition === 'beginning' || descriptionPosition === 'end') && !textToAdd.trim())
                }
              >
                Start Bulk Edit Now
              </Button>
            </BlockStack>
          )}
        </BlockStack>
      </Card>

    </BlockStack>
  );
} 