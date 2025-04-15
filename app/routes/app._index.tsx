/**
 * Index Page Component
 * This component serves as the main bulk editing interface.
 * It provides functionality to:
 * 1. Filter products based on various criteria
 * 2. Preview filtered products
 * 3. Edit product titles in bulk with various options
 * 4. Show success messages using Toast notifications
 * 
 * @author Manar Bakhat
 */

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
  Toast,
  Frame,
  ButtonGroup,
  Layout,
  Box,
  LegacyCard
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { json } from "@remix-run/node";
import { useSubmit, useActionData, useLoaderData, useNavigate, Link } from "@remix-run/react";
import { FilterIcon, EditIcon, ResetIcon } from '@shopify/polaris-icons';
import { Sidebar } from "../components/Sidebar";

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

interface LoaderData {
  shop: {
    name: string;
    email: string;
    myshopifyDomain: string;
  } | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query {
        shop {
          name
          email
          myshopifyDomain
        }
      }`
    );

    const responseJson = await response.json();
    return json({
      shop: responseJson.data.shop
    });
  } catch (error) {
    console.error('Error loading shop data:', error);
    return json({
      shop: null
    });
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

  try {
    if (field === 'productId') {
      // Direct product query for product ID searches
      const response = await admin.graphql(
        `#graphql
        query {
          product(id: "gid://shopify/Product/${value}") {
            id
            title
            description
            productType
            vendor
            status
            featuredImage {
              url
              altText
            }
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }`
      );

      const responseJson = await response.json();
      console.log('Product query response:', responseJson);

      if (responseJson.data?.product) {
        return json({
          data: {
            products: {
              edges: [{
                node: responseJson.data.product
              }]
            }
          }
        });
      }
      return json({ error: 'Product not found' });
    }

    // Regular search query for other fields
  let queryString = '';
  if (value) {
    const fieldMap: { [key: string]: string } = {
      title: 'title',
      collection: 'collection',
        productId: 'id',
      description: 'description',
      price: 'variants.price'
    };

    const searchField = fieldMap[field] || field;
      const escapedValue = value.replace(/['"]/g, '').trim();

    switch (condition) {
      case 'is':
          queryString = `${searchField}:'${escapedValue}'`;
        break;
      case 'contains':
        queryString = `${searchField}:*${escapedValue}*`;
        break;
      case 'doesNotContain':
        queryString = `-${searchField}:*${escapedValue}*`;
        break;
      case 'startsWith':
      case 'endsWith':
        queryString = `${searchField}:*${escapedValue}*`;
        break;
    }
  }

    const graphqlQuery = `#graphql
      query {
        products(first: 50, query: "${queryString}") {
          edges {
            node {
              id
              title
              description
              productType
              vendor
              status
              featuredImage {
                url
                altText
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
    
    console.log('Search parameters:', { field, condition, value });
    console.log('Query string:', queryString);
    console.log('Full GraphQL query:', graphqlQuery);

    const response = await admin.graphql(graphqlQuery);
  const responseJson = await response.json();
    console.log('Raw API response:', responseJson);

    if (field === 'productId') {
      // Handle single product response
      if (responseJson.data?.product) {
        const product = responseJson.data.product;
        return json({
          data: {
            products: {
              edges: [{
                node: product
              }]
            }
          }
        });
      }
    } else if (responseJson.data?.products?.edges) {
      // Handle product list response
      const allProducts = responseJson.data.products.edges;
      const searchValue = value.toLowerCase().trim();
      
      // Filter the products based on condition
      const filteredProducts = {
        edges: allProducts.filter(({ node }: { node: Product }) => {
          const fieldValue = field === 'description' 
            ? (node.description || '').toLowerCase() 
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
            case 'empty':
              return !node.description || node.description.trim() === '';
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
  const { shop } = useLoaderData<LoaderData>();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [selectedSection, setSelectedSection] = useState('home');
  const navigate = useNavigate();

  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  const handleSectionChange = (section: string) => {
    if (section === 'home') {
      setSelectedSection(section);
    } else if (section === 'test') {
      // Redirection vers la page Test
      navigate('/app/test');
    } else {
      // Redirection vers Bulk Edit
      navigate(`/app/bulkEdit?section=${section}`);
    }
  };

  // Render each section content based on selected section
  const renderHomeContent = () => (
          <Card>
      <BlockStack gap="500">
        <Text variant="heading2xl" as="h1">Bulk Product Editor</Text>
        <Text>Welcome to the Bulk Product Editor app. This app allows you to edit multiple product fields in bulk.</Text>
        <Text>Select an option from the sidebar to get started.</Text>
        
        {/* Lien vers la page Test pour voir tous les poids de produits */}
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">Additional Tools</Text>
          <InlineStack>
            <Link to="/app/test" style={{ textDecoration: 'none' }}>
              <Button variant="primary" tone="success">
                View All Product Weights
              </Button>
            </Link>
          </InlineStack>
                </BlockStack>
      </BlockStack>
    </Card>
  );

  return (
    <Frame>
      <Sidebar
        onExpandedChange={handleSidebarChange}
        onSectionChange={handleSectionChange}
        activeSection={selectedSection}
      />
      <div
        style={{
          marginLeft: isSidebarExpanded ? "240px" : "60px",
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          padding: "20px"
        }}
      >
        <Page>
          <Layout>
            <Layout.Section>
              {renderHomeContent()}
            </Layout.Section>
          </Layout>
    </Page>
      </div>
    </Frame>
  );
}