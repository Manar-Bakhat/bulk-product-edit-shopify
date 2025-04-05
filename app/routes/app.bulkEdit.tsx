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
import { EditVendor } from "../components/EditVendor";
import { EditDescription } from "../components/EditDescription";
import { EditTag } from "../components/EditTag";
import { EditStatus } from "../components/EditStatus";
import { EditProductType } from "../components/EditProductType";
import { FilterIcon, EditIcon, ResetIcon } from '@shopify/polaris-icons';
import { useSearchParams, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { handlePriceEdit } from "../services/priceEditService";
import { handleTitleEdit } from "../services/titleEditService";
import { handleVendorEdit } from "../services/vendorEditService";
import { handleDescriptionEdit } from "../services/descriptionEditService";
import { handleTagEdit } from "../services/tagEditService";
import { handleStatusEdit } from "../services/statusEditService";
import { handleProductTypeEdit } from "../services/productTypeEditService";

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
            compareAtPrice?: string | null;
            inventoryItem?: {
              unitCost?: {
                amount: string;
              } | null;
            } | null;
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
              compareAtPrice?: string | null;
              inventoryItem?: {
                unitCost?: {
                  amount: string;
                } | null;
              } | null;
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
        compareAtPrice?: string | null;
        inventoryItem?: {
          unitCost?: {
            amount: string;
          } | null;
        } | null;
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
  const action = formData.get("action") as string;

  // Handle fetch tags action
  if (action === "fetchTags") {
    return handleTagEdit(request, formData);
  }

  if (actionType === "bulkEdit") {
    if (section === "price") {
      return handlePriceEdit(request, formData);
    } else if (section === "title") {
      return handleTitleEdit(request, formData);
    } else if (section === "vendor") {
      return handleVendorEdit(request, formData);
    } else if (section === "description") {
      return handleDescriptionEdit(request, formData);
    } else if (section === "tag") {
      return handleTagEdit(request, formData);
    } else if (section === "status") {
      return handleStatusEdit(request, formData);
    } else if (section === "productType") {
      return handleProductTypeEdit(request, formData);
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section") || "title";
  const [activeSection, setActiveSection] = useState(section);

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  const handleSidebarChange = (expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  };

  const handleSectionChange = (newSection: string) => {
    if (newSection === "home") {
      navigate("/app/dashboard");
    } else {
      navigate(`/app/bulkEdit?section=${newSection}`, { replace: true });
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
      case "vendor":
        return <EditVendor key={section} />;
      case "description":
        return <EditDescription key={section} />;
      case "tag":
        return <EditTag key={section} />;
      case "status":
        return <EditStatus key={section} />;
      case "productType":
        return <EditProductType key={section} />;
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