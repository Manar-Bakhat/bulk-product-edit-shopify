import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  Page,
  Text,
  BlockStack,
  Select,
  TextField,
  Button,
  InlineStack,
  DataTable,
  Card,
  Spinner,
  Badge,
  ProgressBar,
  Divider,
  Banner,
  Icon,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useSubmit, useActionData, useLoaderData } from "@remix-run/react";
import { FilterIcon, EditIcon } from '@shopify/polaris-icons';

interface Product {
  id: string;
  title: string;
  vendor: string;
  featuredImage?: {
    url: string;
    altText?: string;
    width?: number;
    height?: number;
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
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              vendor
              featuredImage {
                url
                altText
                width
                height
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }`
    );

    const responseJson = await response.json();
    console.log('Initial products load:', responseJson);
    return json({ initialProducts: responseJson.data.products });
  } catch (error) {
    console.error('Error loading initial products:', error);
    return json({ initialProducts: { edges: [] } });
  }
};

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  if (actionType === "bulkEdit") {
    const productIds = formData.get("productIds") as string;
    const textToAdd = formData.get("textToAdd") as string;
    const editType = formData.get("editType") as string;
    const replacementText = formData.get("replacementText") as string;
    const capitalizationType = formData.get("capitalizationType") as string;
    const numberOfCharacters = parseInt(formData.get("numberOfCharacters") as string);
    const productIdsArray = JSON.parse(productIds);
    const productTitles = JSON.parse(formData.get("productTitles") as string);

    try {
      // Update each product's title
      for (const productId of productIdsArray) {
        const mutation = `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
          product {
            id
            title
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const currentTitle = productTitles[productId] || '';
        let newTitle = currentTitle;

        switch (editType) {
          case 'addTextBeginning':
            newTitle = `${textToAdd} ${currentTitle}`;
            break;
          case 'addTextEnd':
            newTitle = `${currentTitle} ${textToAdd}`;
            break;
          case 'removeText':
            newTitle = currentTitle.replace(new RegExp(textToAdd, 'g'), '').trim();
            break;
          case 'replaceText':
            newTitle = currentTitle.replace(new RegExp(textToAdd, 'g'), replacementText);
            break;
          case 'capitalize':
            switch (capitalizationType) {
              case 'titleCase':
                newTitle = currentTitle
                  .toLowerCase()
                  .split(' ')
                  .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');
                break;
              case 'uppercase':
                newTitle = currentTitle.toUpperCase();
                break;
              case 'lowercase':
                newTitle = currentTitle.toLowerCase();
                break;
              case 'firstLetter':
                newTitle = currentTitle.charAt(0).toUpperCase() + currentTitle.slice(1).toLowerCase();
                break;
            }
            break;
          case 'truncate':
            if (numberOfCharacters > 0) {
              newTitle = currentTitle.slice(0, numberOfCharacters);
            }
            break;
        }

        const variables = {
          input: {
            id: `gid://shopify/Product/${productId}`,
            title: newTitle
          }
        };

        await admin.graphql(mutation, {
          variables: variables
        });
      }

      return json({ success: true });
    } catch (error) {
      console.error('Error updating products:', error);
      return json({ error: 'Failed to update products' });
    }
  }

  // Existing filter logic
  const field = formData.get("field") as string;
  const condition = formData.get("condition") as string;
  const value = formData.get("value") as string;

  console.log('Filter params:', { field, condition, value });

  let queryString = '';
  if (value) {
    // Convert field names to match Shopify's search syntax
    const fieldMap: { [key: string]: string } = {
      title: 'title',
      collection: 'collection',
      productId: 'id',
      description: 'description',
      price: 'variants.price'
    };

    const searchField = fieldMap[field] || field;
    const escapedValue = value.replace(/['"]/g, '').trim(); // Remove quotes and trim whitespace

    switch (condition) {
      case 'is':
        queryString = `${searchField}:'${escapedValue}'`;
        break;
      case 'contains':
        // For contains, we use a simple search with the field name
        queryString = `${searchField}:*${escapedValue}*`;
        break;
      case 'doesNotContain':
        queryString = `-${searchField}:*${escapedValue}*`;
        break;
      case 'startsWith':
      case 'endsWith':
        // Get all products containing the value and filter them in memory
        queryString = `${searchField}:*${escapedValue}*`;
        break;
    }
  }

  console.log('Generated query string:', queryString);

  try {
    const graphqlQuery = `#graphql
      query {
        products(first: 50, query: "${queryString}") {
          edges {
            node {
              id
              title
              vendor
              featuredImage {
                url
                altText
                width
                height
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;
    
    console.log('Full GraphQL query:', graphqlQuery);

    const response = await admin.graphql(graphqlQuery);
    const responseJson = await response.json();
    console.log('Filtered products response:', responseJson);

    if (responseJson.data?.products?.edges) {
      const allProducts = responseJson.data.products.edges;
      const searchValue = value.toLowerCase().trim();
      
      // Filter the products based on condition
      const filteredProducts = {
        edges: allProducts.filter(({ node }: { node: Product }) => {
          const fieldValue = field === 'description' 
            ? ''
            : node.title.toLowerCase();
          
          switch (condition) {
            case 'is':
              return fieldValue === searchValue;
            case 'contains':
              return fieldValue.includes(searchValue);
            case 'doesNotContain':
              return !fieldValue.includes(searchValue);
            case 'startsWith':
              return fieldValue.startsWith(searchValue);
            case 'endsWith':
              return fieldValue.endsWith(searchValue);
            default:
              return true;
          }
        })
      };
      
      console.log('Filtered products:', filteredProducts);
      
      return json({
        data: {
          products: filteredProducts
        }
      });
    }

    console.error('No products data in response:', responseJson);
    return json({ error: 'No products data received' });
  } catch (error) {
    console.error('Error fetching filtered products:', error);
    return json({ error: 'Failed to fetch products', details: error });
  }
}

export default function Index() {
  const loaderData = useLoaderData<{ initialProducts: { edges: Array<{ node: Product }> } }>();
  const [selectedField, setSelectedField] = useState('title');
  const [selectedCondition, setSelectedCondition] = useState('contains');
  const [filterValue, setFilterValue] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEditOption, setSelectedEditOption] = useState('');
  const [textToAdd, setTextToAdd] = useState('');
  const [textToReplace, setTextToReplace] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [capitalizationType, setCapitalizationType] = useState('titleCase');
  const [numberOfCharacters, setNumberOfCharacters] = useState('');
  const submit = useSubmit();
  const actionData = useActionData<ActionData>();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4; // Changed from 10 to 4 items per page

  // Load initial products only if no search has been performed
  useEffect(() => {
    if (!hasSearched && loaderData?.initialProducts?.edges) {
      console.log('Setting initial products:', loaderData.initialProducts);
      const initialProducts = loaderData.initialProducts.edges.map(({ node }) => ({
        id: node.id.replace('gid://shopify/Product/', ''),
        title: node.title,
        vendor: node.vendor,
        featuredImage: node.featuredImage,
        priceRangeV2: node.priceRangeV2
      }));
      setProducts(initialProducts);
    }
  }, [loaderData, hasSearched]);

  // Handle filtered products
  useEffect(() => {
    if (actionData) {
      console.log('Action data received:', actionData);
      if (actionData.data?.products?.edges) {
        const filteredProducts = actionData.data.products.edges.map(({ node }) => ({
          id: node.id.replace('gid://shopify/Product/', ''),
          title: node.title,
          vendor: node.vendor,
          featuredImage: node.featuredImage,
          priceRangeV2: node.priceRangeV2
        }));
        console.log('Setting filtered products:', filteredProducts);
        setProducts(filteredProducts);
        setHasSearched(true);
      }
      setIsLoading(false);
    }
  }, [actionData]);

  const fieldOptions = [
    { label: 'Title', value: 'title' },
    { label: 'Vendor', value: 'vendor' },
  ];

  // Base condition options
  const baseConditionOptions = [
    { label: 'is', value: 'is' },
    { label: 'contains', value: 'contains' },
    { label: 'does not contain', value: 'doesNotContain' },
    { label: 'starts with', value: 'startsWith' },
    { label: 'ends with', value: 'endsWith' },
  ];

  // Handle field change
  const handleFieldChange = (value: string) => {
    setSelectedField(value);
  };

  const handlePreview = () => {
    console.log('Preview clicked with values:', {
      field: selectedField,
      condition: selectedCondition,
      value: filterValue
    });
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(1); // Reset to first page when performing a new search
    const formData = new FormData();
    formData.append("field", selectedField);
    formData.append("condition", selectedCondition);
    formData.append("value", filterValue);
    submit(formData, { method: "post" });
  };

  const editOptions = [
    { label: 'Add text at the beginning of title', value: 'addTextBeginning' },
    { label: 'Add text to the end of title', value: 'addTextEnd' },
    { label: 'Find and remove text from title', value: 'removeText' },
    { label: 'Find and replace text in title', value: 'replaceText' },
    { label: 'Change title capitalization', value: 'capitalize' },
    { label: 'Keep the first X number of characters', value: 'truncate' }
  ];

  const handleEditOptionChange = (value: string) => {
    setSelectedEditOption(value);
  };

  const handleBulkEdit = () => {
    if (selectedEditOption === 'replaceText') {
      if (!textToReplace.trim() || !replacementText.trim()) {
        return;
      }
    } else if (selectedEditOption === 'capitalize') {
      // No validation needed for capitalization
    } else if (selectedEditOption === 'truncate') {
      const num = parseInt(numberOfCharacters);
      if (isNaN(num) || num <= 0) {
        return;
      }
    } else if (!textToAdd.trim()) {
      return;
    }

    const productIds = products.map(product => product.id);
    const productTitles = products.reduce((acc, product) => {
      acc[product.id] = product.title;
      return acc;
    }, {} as Record<string, string>);

    const formData = new FormData();
    formData.append("actionType", "bulkEdit");
    formData.append("productIds", JSON.stringify(productIds));
    formData.append("productTitles", JSON.stringify(productTitles));
    formData.append("textToAdd", selectedEditOption === 'replaceText' ? textToReplace : textToAdd);
    formData.append("replacementText", replacementText);
    formData.append("editType", selectedEditOption);
    formData.append("capitalizationType", capitalizationType);
    formData.append("numberOfCharacters", numberOfCharacters);
    submit(formData, { method: "post" });
  };

  // Add pagination handlers
  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(products.length / itemsPerPage)));
  };

  // Modify the rows calculation to handle pagination
  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const rows = paginatedProducts.map((product) => [
    <div style={{ 
      width: '100px', 
      height: '100px', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--p-color-bg-surface)',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {product.featuredImage?.url ? (
        <img 
          src={product.featuredImage.url}
          alt={product.title}
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }} 
          onError={(e) => {
            e.currentTarget.src = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png';
          }}
        />
      ) : (
        <img 
          src="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"
          alt="Product placeholder"
          style={{ 
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: 0.5
          }} 
        />
      )}
    </div>,
    <Text variant="bodyMd" as="span">{product.title}</Text>,
    <Text variant="bodyMd" as="span">{product.vendor}</Text>,
    <Text variant="bodyMd" as="span">
      {`${parseFloat(product.priceRangeV2?.minVariantPrice?.amount || '0').toFixed(2)} ${product.priceRangeV2?.minVariantPrice?.currencyCode || 'USD'}`}
    </Text>
  ]);

  return (
    <Page>
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
                  options={baseConditionOptions}
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
                        columnContentTypes={['text', 'text', 'text', 'text']}
                        headings={[
                          <Text variant="headingSm" as="span">Image</Text>,
                          <Text variant="headingSm" as="span">Title</Text>,
                          <Text variant="headingSm" as="span">Vendor</Text>,
                          <Text variant="headingSm" as="span">Price</Text>
                        ]}
                        rows={rows}
                      />
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                        <Pagination
                          hasPrevious={currentPage > 1}
                          hasNext={currentPage < Math.ceil(products.length / itemsPerPage)}
                          onPrevious={handlePreviousPage}
                          onNext={handleNextPage}
                          label={`${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
                            currentPage * itemsPerPage,
                            products.length
                          )} of ${products.length}`}
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
                onChange={handleEditOptionChange}
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
    </Page>
  );
}