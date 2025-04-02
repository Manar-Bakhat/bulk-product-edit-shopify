/**
 * EditVendor Component
 * This component handles bulk editing of product vendors.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit product vendors in bulk
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
import { FilterIcon, ResetIcon, EditIcon } from '@shopify/polaris-icons';
import { useSubmit, useActionData, useLoaderData, useSearchParams } from "@remix-run/react";
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

export function EditVendor() {
  const [searchParams] = useSearchParams();
  const currentSection = searchParams.get("section");

  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Add new state for vendor editing
  const [selectedEditOption, setSelectedEditOption] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [capitalizationType, setCapitalizationType] = useState('titleCase');

  // Remix hooks for form submission and data handling
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();

  // Reset all states when section changes
  useEffect(() => {
    if (currentSection === "vendor") {
      setSelectedField('title');
      setSelectedCondition('contains');
      setFilterValue('');
      setHasSearched(false);
      setProducts([]);
      setCurrentPage(1);
      setSelectedEditOption('');
      setNewVendor('');
      setCapitalizationType('titleCase');
    }
  }, [currentSection]);

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
    formData.append("section", "vendor");
    formData.append("currentSection", "vendor");
    submit(formData, { method: "post" });
  };

  const handleClearFilters = () => {
    setSelectedField('title');
    setSelectedCondition('contains');
    setFilterValue('');
    setHasSearched(false);
    setProducts([]);
  };

  // Add vendor edit options
  const editOptions = [
    { label: 'Update vendor', value: 'updateVendor' },
    { label: 'Change Vendor Capitalization', value: 'capitalizeVendor' }
  ];

  // Add capitalization options
  const capitalizationOptions = [
    { label: 'First Letter Of Each Word Is Uppercase', value: 'titleCase' },
    { label: 'UPPERCASE', value: 'uppercase' },
    { label: 'lowercase', value: 'lowercase' },
    { label: 'First letter of vendor uppercase', value: 'firstLetter' }
  ];

  /**
   * Effect to handle successful bulk edit
   * Shows success message and resets form
   */
  useEffect(() => {
    if (actionData) {
      console.log('[EditVendor] Received action data:', actionData);
      
      if (actionData.success) {
        console.log('[EditVendor] Bulk edit successful!');
        // Reset form fields
        setSelectedEditOption('');
        setNewVendor('');
        setCapitalizationType('titleCase');

        // Show success message
        Swal.fire({
          title: 'Success!',
          text: actionData.message || 'Vendors updated successfully!',
          icon: 'success',
          confirmButtonText: 'OK'
        }).then(() => {
          // Refresh the page to show updated data
          window.location.reload();
        });
      } else if (actionData.error) {
        console.error('[EditVendor] Bulk edit failed:', actionData.error);
        Swal.fire({
          title: 'Error',
          text: actionData.error,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  }, [actionData]);

  /**
   * Handles bulk vendor editing
   * Submits edit criteria to the server
   */
  const handleBulkEdit = () => {
    console.log('[EditVendor] Starting bulk edit process');
    
    // Check if products have been filtered first
    if (!hasSearched || products.length === 0) {
      console.log('[EditVendor] No products selected');
      Swal.fire({
        title: 'Error',
        text: 'Please filter and preview products first before starting bulk edit',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Validate inputs based on edit type
    if (selectedEditOption === 'updateVendor' && !newVendor.trim()) {
      console.log('[EditVendor] No vendor name provided');
      Swal.fire({
        title: 'Error',
        text: 'Please enter a new vendor name',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    console.log('[EditVendor] Preparing form data:', {
      productIds: products.map(p => p.id),
      productVendors: products.reduce((acc, p) => ({ ...acc, [p.id]: p.vendor }), {}),
      newVendor,
      editType: selectedEditOption,
      capitalizationType
    });

    const productIds = products.map(product => product.id);
    const productVendors = products.reduce((acc, product) => {
      acc[product.id] = product.vendor;
      return acc;
    }, {} as Record<string, string>);

    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("section", "vendor");
    formData.append("productIds", JSON.stringify(productIds));
    formData.append("productVendors", JSON.stringify(productVendors));
    formData.append("newVendor", newVendor);
    formData.append("editType", selectedEditOption);
    formData.append("capitalizationType", capitalizationType);

    console.log('[EditVendor] Submitting form data...');
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
              <Text variant="headingSm" as="h2">Edit Vendors</Text>
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
            
            {selectedEditOption === 'updateVendor' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Update Vendor To</Text>
                <div style={{ maxWidth: '400px' }}>
                  <TextField
                    label=""
                    value={newVendor}
                    onChange={setNewVendor}
                    placeholder="Enter new vendor name"
                    autoComplete="off"
                  />
                </div>
                <Button variant="primary" onClick={handleBulkEdit} tone="success">
                  Start bulk edit now
                </Button>
              </BlockStack>
            )}

            {selectedEditOption === 'capitalizeVendor' && (
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">Change Vendor Capitalization</Text>
                <div style={{ maxWidth: '400px' }}>
                  <Select
                    label=""
                    options={capitalizationOptions}
                    value={capitalizationType}
                    onChange={setCapitalizationType}
                    placeholder="Select capitalization type"
                  />
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