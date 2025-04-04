/**
 * EditTitle Component
 * This component handles bulk editing of product titles.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit product titles in bulk with various options
 * 4. Show success messages using SweetAlert2
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
import { FilterIcon, EditIcon, ResetIcon } from '@shopify/polaris-icons';
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
 * EditTitle Component
 * Main component for bulk title editing functionality
 */
export function EditTitle() {
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
  
  // State for title editing options
  const [selectedEditOption, setSelectedEditOption] = useState('');
  const [textToAdd, setTextToAdd] = useState('');
  const [textToReplace, setTextToReplace] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [capitalizationType, setCapitalizationType] = useState('titleCase');
  const [numberOfCharacters, setNumberOfCharacters] = useState('');
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

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
    setSelectedEditOption('');
    setTextToAdd('');
    setTextToReplace('');
    setReplacementText('');
    setCapitalizationType('titleCase');
    setNumberOfCharacters('');
    setCurrentPage(1);
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

  // Title editing options
  const editOptions = [
    { label: 'Add text at the beginning of title', value: 'addTextBeginning' },
    { label: 'Add text to the end of title', value: 'addTextEnd' },
    { label: 'Find and remove text from title', value: 'removeText' },
    { label: 'Find and replace text in title', value: 'replaceText' },
    { label: 'Change title capitalization', value: 'capitalize' },
    { label: 'Keep the first X number of characters', value: 'truncate' }
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
    formData.append("section", "title");
    formData.append("currentSection", currentSection || "title");
    submit(formData, { method: "post" });
  };

  /**
   * Handles bulk title editing
   * Submits edit criteria to the server
   */
  const handleBulkEdit = () => {
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
    if (selectedEditOption === 'replaceText') {
      if (!textToReplace.trim() || !replacementText.trim()) {
        Swal.fire({
          title: 'Error',
          text: 'Please enter both text to find and replacement text',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        return;
      }
    } else if (selectedEditOption === 'truncate') {
      const num = parseInt(numberOfCharacters);
      if (isNaN(num) || num <= 0) {
        Swal.fire({
          title: 'Error',
          text: 'Please enter a valid number of characters',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
        return;
      }
    } else if (selectedEditOption === 'capitalize') {
      // No validation needed for capitalization
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

    // Check if text exists in any product title for removeText operation
    if (selectedEditOption === 'removeText') {
      const productsWithText = products.filter(product => 
        product.title.toLowerCase().includes(textToAdd.toLowerCase())
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
          text: `The text "${textToAdd}" was found in ${productsWithText.length} out of ${products.length} products. Do you want to continue?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, continue',
          cancelButtonText: 'No, cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            // Continue with the bulk edit
            const productIds = productsWithText.map(product => product.id);
            const productTitles = productsWithText.reduce((acc, product) => {
              acc[product.id] = product.title;
              return acc;
            }, {} as Record<string, string>);

            const formData = new FormData();
            formData.append("actionType", "bulkEdit");
            formData.append("section", "title");
            formData.append("productIds", JSON.stringify(productIds));
            formData.append("productTitles", JSON.stringify(productTitles));
            formData.append("textToAdd", textToAdd);
            formData.append("editType", selectedEditOption);
            formData.append("capitalizationType", capitalizationType);
            formData.append("numberOfCharacters", numberOfCharacters);
            submit(formData, { method: "post" });
          }
        });
        return;
      }
    }

    // Check if text exists in any product title for replaceText operation
    if (selectedEditOption === 'replaceText') {
      const productsWithText = products.filter(product => 
        product.title.toLowerCase().includes(textToReplace.toLowerCase())
      );

      if (productsWithText.length === 0) {
        Swal.fire({
          title: 'Error',
          text: 'Text to replace not found in any of the filtered products',
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
          text: `The text "${textToReplace}" was found in ${productsWithText.length} out of ${products.length} products. Do you want to continue?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Yes, continue',
          cancelButtonText: 'No, cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            // Continue with the bulk edit
            const productIds = productsWithText.map(product => product.id);
            const productTitles = productsWithText.reduce((acc, product) => {
              acc[product.id] = product.title;
              return acc;
            }, {} as Record<string, string>);

            const formData = new FormData();
            formData.append("actionType", "bulkEdit");
            formData.append("section", "title");
            formData.append("productIds", JSON.stringify(productIds));
            formData.append("productTitles", JSON.stringify(productTitles));
            formData.append("textToAdd", textToReplace);
            formData.append("replacementText", replacementText);
            formData.append("editType", selectedEditOption);
            formData.append("capitalizationType", capitalizationType);
            formData.append("numberOfCharacters", numberOfCharacters);
            submit(formData, { method: "post" });
          }
        });
        return;
      }
    }

    const productIds = products.map(product => product.id);
    const productTitles = products.reduce((acc, product) => {
      acc[product.id] = product.title;
      return acc;
    }, {} as Record<string, string>);

    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "title");
    formData.append("productIds", JSON.stringify(productIds));
    formData.append("productTitles", JSON.stringify(productTitles));
    formData.append("textToAdd", selectedEditOption === 'replaceText' ? textToReplace : textToAdd);
    formData.append("replacementText", replacementText);
    formData.append("editType", selectedEditOption);
    formData.append("capitalizationType", capitalizationType);
    formData.append("numberOfCharacters", numberOfCharacters);
    submit(formData, { method: "post" });
  };

  /**
   * Effect to handle successful bulk edit
   * Shows success message and resets form
   */
  useEffect(() => {
    if (actionData) {
      console.log('[EditTitle] Received action data:', actionData);
      
      if (actionData.success) {
        console.log('[EditTitle] Bulk edit successful!');
        // Reset form fields
        setSelectedEditOption('');
        setTextToAdd('');
        setTextToReplace('');
        setReplacementText('');
        setNumberOfCharacters('');

        // Show success message
        Swal.fire({
          title: 'Success!',
          text: 'Product titles updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: "#008060"
        });
      } else if (actionData.error) {
        console.error('[EditTitle] Bulk edit failed:', actionData.error);
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
              <Text variant="headingSm" as="h2">Edit Products</Text>
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
            
            {(selectedEditOption === 'addTextBeginning' || selectedEditOption === 'addTextEnd' || selectedEditOption === 'removeText' || selectedEditOption === 'replaceText' || selectedEditOption === 'capitalize' || selectedEditOption === 'truncate') && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">
                  {selectedEditOption === 'removeText' ? 'Remove' : 
                   selectedEditOption === 'replaceText' ? 'Replace' : 
                   selectedEditOption === 'capitalize' ? 'Capitalize' : 
                   selectedEditOption === 'truncate' ? 'Truncate' : 'Add'}
                </Text>
                <div style={{ maxWidth: '400px' }}>
                  {selectedEditOption === 'replaceText' ? (
                    <BlockStack gap="400">
                      <TextField
                        label="Find"
                        value={textToReplace}
                        onChange={setTextToReplace}
                        placeholder="Enter text to find"
                        autoComplete="off"
                      />
                      <TextField
                        label="Replace with"
                        value={replacementText}
                        onChange={setReplacementText}
                        placeholder="Enter replacement text"
                        autoComplete="off"
                      />
                    </BlockStack>
                  ) : selectedEditOption === 'capitalize' ? (
                    <BlockStack gap="400">
                      <Select
                        label="Capitalization type"
                        options={[
                          { label: 'First Letter Of Each Word Is Uppercase', value: 'titleCase' },
                          { label: 'UPPERCASE', value: 'uppercase' },
                          { label: 'lowercase', value: 'lowercase' },
                          { label: 'First letter of title uppercase', value: 'firstLetter' }
                        ]}
                        value={capitalizationType}
                        onChange={setCapitalizationType}
                      />
                    </BlockStack>
                  ) : selectedEditOption === 'truncate' ? (
                    <BlockStack gap="400">
                      <TextField
                        label="Number of characters"
                        type="number"
                        value={numberOfCharacters}
                        onChange={setNumberOfCharacters}
                        placeholder="Enter number of characters to keep"
                        autoComplete="off"
                      />
                    </BlockStack>
                  ) : (
                    <TextField
                      label=""
                      value={textToAdd}
                      onChange={setTextToAdd}
                      placeholder={
                        selectedEditOption === 'removeText'
                          ? 'Enter text to remove from titles'
                          : `Enter text to add ${selectedEditOption === 'addTextBeginning' ? 'at the beginning' : 'to the end'} of titles`
                      }
                      autoComplete="off"
                    />
                  )}
                </div>
                <Button variant="primary" onClick={handleBulkEdit} tone="success">
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