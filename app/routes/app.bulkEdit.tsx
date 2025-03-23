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

  // Filter logic
  const field = formData.get("field") as string;
  const condition = formData.get("condition") as string;
  const value = formData.get("value") as string;

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

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
    <EditTitle />
  );

  const renderPriceContent = () => {
    return <EditPrice />;
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