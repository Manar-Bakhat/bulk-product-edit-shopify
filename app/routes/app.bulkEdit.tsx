/**
 * Bulk Edit Page Component
 * This component serves as a container for the bulk editing features.
 * It handles:
 * 1. Navigation between different editing sections (title, price)
 * 2. Display of the appropriate editing component based on the selected section
 * 
 * @author Manar Bakhat
 */

import { useState, useEffect } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Frame,
  BlockStack,
  Box,
  Button,
  TextField,
  DataTable,
  EmptyState,
  LegacyCard,
  Select,
  InlineStack,
  Icon,
  Divider,
  Banner,
  Spinner,
  Badge,
  ProgressBar,
  Pagination,
  Toast
} from "@shopify/polaris";
import { Sidebar } from "../components/Sidebar";
import { EditTitle } from "../components/EditTitle";
import { EditPrice } from "../components/EditPrice";
import { FilterIcon, EditIcon, ResetIcon } from '@shopify/polaris-icons';
import { useSearchParams, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

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

interface GraphQLResponse {
  data?: {
    product?: {
      id: string;
      variants?: {
        edges: Array<{
          node: {
            id: string;
            price: string;
          };
        }>;
      };
    };
    productUpdate?: {
      product: {
        id: string;
        variants: {
          edges: Array<{
            node: {
              id: string;
              price: string;
            };
          }>;
        };
      };
      userErrors: Array<{
        field: string;
        message: string;
      }>;
    };
    productVariantsBulkUpdate?: {
      variants: Array<{
        id: string;
        price: string;
      }>;
      userErrors: Array<{
        field: string;
        message: string;
      }>;
    };
  };
  errors?: Array<{
    message: string;
    locations: Array<{
      line: number;
      column: number;
    }>;
    path: string[];
  }>;
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
      }`
    );

    const responseJson = await response.json();
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
  const section = formData.get("section") as string;

  if (actionType === "bulkEdit") {
    const productIds = formData.get("productIds") as string;
    const section = formData.get("section") as string;
    const productIdsArray = JSON.parse(productIds);

    if (section === "price") {
      const newPrice = formData.get("newPrice") as string;
      const editType = formData.get("editType") as string;

      try {
        console.log('[Price Update] Starting price update process');
        console.log('[Price Update] New price:', newPrice);
        console.log('[Price Update] Product IDs:', productIdsArray);

        // Update each product's price
        for (const productId of productIdsArray) {
          console.log(`[Price Update] Processing product ID: ${productId}`);
          
          // First, get the product's variants
          const getProductQuery = `#graphql
            query {
              product(id: "gid://shopify/Product/${productId}") {
                id
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
          `;

          console.log('[Price Update] Fetching product variants...');
          const productResponse = await admin.graphql(getProductQuery);
          const productData = (await productResponse.json()) as unknown as GraphQLResponse;
          
          console.log('[Price Update] Product data received:', productData);
          
          if (productData.errors) {
            console.error('[Price Update] GraphQL errors:', productData.errors);
            throw new Error(`GraphQL errors: ${JSON.stringify(productData.errors)}`);
          }

          if (!productData.data?.product?.variants?.edges?.length) {
            console.error('[Price Update] No variants found for product:', productId);
            throw new Error(`No variants found for product: ${productId}`);
          }

          const variantId = productData.data.product.variants.edges[0].node.id;
          console.log('[Price Update] Found variant ID:', variantId);

          const mutation = `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                productVariants {
                  id
                  price
                  compareAtPrice
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          const variables = {
            productId: `gid://shopify/Product/${productId}`,
            variants: [{
              id: variantId,
              ...(editType === 'setCompareAtPrice' ? { compareAtPrice: newPrice } : { price: newPrice })
            }]
          };

          console.log('[Price Update] Updating price with variables:', variables);
          const updateResponse = await admin.graphql(mutation, {
            variables: variables
          });
          
          const updateData = (await updateResponse.json()) as unknown as GraphQLResponse;
          console.log('[Price Update] Update response:', updateData);
          
          if (updateData.errors) {
            console.error('[Price Update] Update mutation errors:', updateData.errors);
            throw new Error(`Update mutation errors: ${JSON.stringify(updateData.errors)}`);
          }

          const userErrors = updateData.data?.productVariantsBulkUpdate?.userErrors;
          if (userErrors && userErrors.length > 0) {
            console.error('[Price Update] User errors:', userErrors);
            throw new Error(`User errors: ${JSON.stringify(userErrors)}`);
          }

          console.log('[Price Update] Successfully updated price for product:', productId);
        }

        console.log('[Price Update] All products updated successfully');
        return json({ success: true });
      } catch (error) {
        console.error('[Price Update] Detailed error:', error);
        return json({ 
          error: 'Failed to update products',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      // Existing title edit logic
      const textToAdd = formData.get("textToAdd") as string;
      const editType = formData.get("editType") as string;
      const replacementText = formData.get("replacementText") as string;
      const capitalizationType = formData.get("capitalizationType") as string;
      const numberOfCharacters = parseInt(formData.get("numberOfCharacters") as string);
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
  }

  // Filter logic
  const field = formData.get("field") as string;
  const condition = formData.get("condition") as string;
  const value = formData.get("value") as string;

  try {
    // Reset previous search results if section changed
    if (section !== formData.get("currentSection")) {
      return json({
        data: {
          products: {
            edges: []
          }
        }
      });
    }

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

    const response = await admin.graphql(graphqlQuery);
    const responseJson = await response.json();

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
        edges: allProducts.filter(({ node }: { node: any }) => {
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
      
      return json({
        data: {
          products: filteredProducts
        }
      });
    }

    return json({ error: 'No products data received' });
  } catch (error) {
    console.error('Error fetching filtered products:', error);
    return json({ error: 'Failed to fetch products', details: error });
  }
}

export default function BulkEdit() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("title");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") || "title";

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    if (section === "home") {
      navigate("/app/dashboard");
    } else if (section === "title" || section === "price") {
      navigate(`/app/bulkEdit?section=${section}`);
    }
  };

  const renderTitleContent = () => (
    <EditTitle key={section} />
  );

  const renderPriceContent = () => {
    return <EditPrice key={section} />;
  };

  const renderContent = () => {
    switch (activeSection) {
      case "title":
        return renderTitleContent();
      case "price":
        return renderPriceContent();
      default:
        return null;
    }
  };

  return (
    <Frame>
      <Sidebar
        onExpandedChange={handleSidebarChange}
        onSectionChange={handleSectionChange}
        activeSection={activeSection}
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
              {renderContent()}
            </Layout.Section>
          </Layout>
        </Page>
      </div>
    </Frame>
  );
}