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

  if (actionType === "bulkEdit") {
    const productIds = formData.get("productIds") as string;
    const section = formData.get("section") as string;
    const productIdsArray = JSON.parse(productIds);

    if (section === "price") {
      const newPrice = formData.get("newPrice") as string;
      const editType = formData.get("editType") as string;
      const adjustmentType = formData.get("adjustmentType") as string;
      const adjustmentAmount = formData.get("adjustmentAmount") as string;
      const setCompareAtPriceToOriginal = formData.get("setCompareAtPriceToOriginal") === "true";

      try {
        console.log('[Price Update] Starting price update process');
        console.log('[Price Update] Edit type:', editType);
        console.log('[Price Update] Product IDs:', productIdsArray);
        if (editType === 'adjustPrice' || editType === 'adjustPriceByPercentage' || 
            editType === 'adjustCompareAtPrice' || editType === 'adjustCompareAtPriceByPercentage' ||
            editType === 'setPriceToCompareAtPercentage' || editType === 'setPriceToCompareAtPercentageLess') {
          console.log('[Price Update] Adjustment type:', adjustmentType);
          console.log('[Price Update] Adjustment amount:', adjustmentAmount);
          console.log('[Price Update] Set compare-at price to original:', setCompareAtPriceToOriginal);
        } else {
          console.log('[Price Update] New price:', newPrice);
        }

        // Validate required fields based on edit type
        if (editType === 'adjustPrice' || editType === 'adjustCompareAtPrice') {
          if (!adjustmentType || !adjustmentAmount) {
            throw new Error('Adjustment type and amount are required for price adjustments');
          }
          
          const amount = parseFloat(adjustmentAmount);
          if (isNaN(amount) || amount <= 0) {
            throw new Error('Invalid adjustment amount');
          }
        } else if (editType === 'adjustPriceByPercentage' || editType === 'adjustCompareAtPriceByPercentage') {
          if (!adjustmentType || !adjustmentAmount) {
            throw new Error('Adjustment type and percentage are required for percentage adjustments');
          }
          
          const percentage = parseFloat(adjustmentAmount);
          if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            throw new Error('Percentage must be between 0 and 100');
          }
        } else if (editType === 'setPriceToCompareAtPercentage' || editType === 'setPriceToCompareAtPercentageLess') {
          if (!adjustmentAmount) {
            throw new Error('Percentage is required for setting price to percentage');
          }
          
          const percentage = parseFloat(adjustmentAmount);
          if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            throw new Error('Percentage must be between 0 and 100');
          }
        } else if (editType === 'setCompareAtPriceToPricePercentage') {
          if (!adjustmentAmount) {
            throw new Error('Percentage is required for setting compare-at price to percentage');
          }
          
          const percentage = parseFloat(adjustmentAmount);
          if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            throw new Error('Percentage must be between 0 and 100');
          }
        } else if (editType === 'setCompareAtPriceToCostPercentage') {
          if (!adjustmentAmount) {
            throw new Error('Percentage is required for setting compare-at price based on cost');
          }
          
          const percentage = parseFloat(adjustmentAmount);
          if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            throw new Error('Percentage must be between 0 and 100');
          }
        }

        // Update each product's price sequentially
        for (const productId of productIdsArray) {
          console.log(`[Price Update] Processing product ID: ${productId}`);
          
          // First, get all product variants
          const getProductQuery = `#graphql
            query {
              product(id: "gid://shopify/Product/${productId}") {
                id
                variants(first: 250) {
                  edges {
                    node {
                      id
                      price
                      compareAtPrice
                      inventoryItem {
                        unitCost {
                          amount
                        }
                      }
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

          // Get all variant IDs and their current prices
          const variants = productData.data.product.variants.edges.map(edge => ({
            id: edge.node.id,
            price: parseFloat(edge.node.price),
            compareAtPrice: edge.node.compareAtPrice ? parseFloat(edge.node.compareAtPrice) : null,
            cost: edge.node.inventoryItem?.unitCost?.amount ? parseFloat(edge.node.inventoryItem.unitCost.amount) : null
          }));
          console.log('[Price Update] Found variants:', variants);

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

          // Create variables for all variants based on edit type
          const variables = {
            productId: `gid://shopify/Product/${productId}`,
            variants: variants.map(variant => {
              let newVariantPrice = variant.price;
              let newCompareAtPrice = variant.compareAtPrice;
              
              if (editType === 'adjustPrice') {
                const adjustment = parseFloat(adjustmentAmount);
                const originalPrice = variant.price;
                
                if (adjustmentType === 'increase') {
                  newVariantPrice = originalPrice + adjustment;
                } else {
                  newVariantPrice = originalPrice - adjustment;
                  // Ensure price doesn't go below 0
                  if (newVariantPrice < 0) {
                    newVariantPrice = 0;
                  }
                }

                // If checkbox is checked, set compare-at price to original price
                if (setCompareAtPriceToOriginal) {
                  newCompareAtPrice = originalPrice;
                }
              } else if (editType === 'adjustPriceByPercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const originalPrice = variant.price;
                
                if (adjustmentType === 'increase') {
                  newVariantPrice = originalPrice * (1 + percentage / 100);
                } else {
                  newVariantPrice = originalPrice * (1 - percentage / 100);
                  // Ensure price doesn't go below 0
                  if (newVariantPrice < 0) {
                    newVariantPrice = 0;
                  }
                }

                // If checkbox is checked, set compare-at price to original price
                if (setCompareAtPriceToOriginal) {
                  newCompareAtPrice = originalPrice;
                }
              } else if (editType === 'adjustCompareAtPrice') {
                const adjustment = parseFloat(adjustmentAmount);
                const basePrice = variant.compareAtPrice || variant.price;
                
                if (adjustmentType === 'increase') {
                  newCompareAtPrice = basePrice + adjustment;
                } else {
                  newCompareAtPrice = basePrice - adjustment;
                  // Ensure compare-at price doesn't go below 0
                  if (newCompareAtPrice < 0) {
                    newCompareAtPrice = 0;
                  }
                }
              } else if (editType === 'adjustCompareAtPriceByPercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const basePrice = variant.compareAtPrice || variant.price;
                
                if (adjustmentType === 'increase') {
                  newCompareAtPrice = basePrice * (1 + percentage / 100);
                } else {
                  newCompareAtPrice = basePrice * (1 - percentage / 100);
                  // Ensure compare-at price doesn't go below 0
                  if (newCompareAtPrice < 0) {
                    newCompareAtPrice = 0;
                  }
                }
              } else if (editType === 'setPriceToCompareAtPercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const compareAtPrice = variant.compareAtPrice || variant.price;
                
                // Set the new price to the specified percentage of the compare-at price
                newVariantPrice = compareAtPrice * (percentage / 100);
                
                // Ensure price doesn't go below 0
                if (newVariantPrice < 0) {
                  newVariantPrice = 0;
                }
              } else if (editType === 'setPriceToCompareAtPercentageLess') {
                const percentage = parseFloat(adjustmentAmount);
                const compareAtPrice = variant.compareAtPrice || variant.price;
                
                // Calculate the new price by subtracting the percentage from the compare-at price
                // Example: If compare-at price is 44.50 and percentage is 5%, then:
                // 44.50 - (44.50 × 0.05) = 42.275
                newVariantPrice = compareAtPrice - (compareAtPrice * (percentage / 100));
                
                // Ensure price doesn't go below 0
                if (newVariantPrice < 0) {
                  newVariantPrice = 0;
                }
              } else if (editType === 'setCompareAtPriceToPricePercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const currentPrice = variant.price;
                
                console.log(`[Price Update] Calculating compare-at price for variant ${variant.id}:`);
                console.log(`[Price Update] Current price: ${currentPrice} MAD`);
                console.log(`[Price Update] Target percentage: ${percentage}%`);
                
                // Calculate the new compare-at price so that the current price is lower by the specified percentage
                // Example: If current price is 42.28 MAD and we want it to be 10% lower than compare-at price:
                // compareAtPrice = 42.28 / (1 - 10/100) = 42.28 / 0.90 = 46.98 MAD
                // This means: 46.98 - (46.98 × 0.10) = 42.28
                // So the current price (42.28) is 10% lower than the compare-at price (46.98)
                newCompareAtPrice = Math.round((currentPrice / (1 - percentage / 100)) * 100) / 100;
                
                console.log(`[Price Update] Calculated compare-at price: ${newCompareAtPrice} MAD`);
                console.log(`[Price Update] Verification: ${newCompareAtPrice} - (${newCompareAtPrice} × ${percentage/100}) = ${newCompareAtPrice - (newCompareAtPrice * percentage/100)} MAD`);
                
                // Ensure compare-at price doesn't go below 0
                if (newCompareAtPrice < 0) {
                  newCompareAtPrice = 0;
                  console.log(`[Price Update] Compare-at price was negative, setting to 0`);
                }
              } else if (editType === 'setCompareAtPriceToCostPercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const cost = variant.cost || 0;
                
                console.log(`[Price Update] Calculating compare-at price based on cost for variant ${variant.id}:`);
                console.log(`[Price Update] Cost: ${cost} MAD`);
                console.log(`[Price Update] Target percentage: ${percentage}%`);
                
                // Calculate the new compare-at price as a percentage of the cost
                // Formula: Compare-at Price = Cost × (1 + Percentage / 100)
                // Example: If cost is 30 MAD and we want 50% markup:
                // compareAtPrice = 30 × (1 + 50/100) = 30 × 1.5 = 45 MAD
                newCompareAtPrice = Math.round((cost * (1 + percentage / 100)) * 100) / 100;
                
                console.log(`[Price Update] Calculated compare-at price: ${newCompareAtPrice} MAD`);
                console.log(`[Price Update] Verification: ${cost} × (1 + ${percentage/100}) = ${newCompareAtPrice} MAD`);
                
                // Ensure compare-at price doesn't go below 0
                if (newCompareAtPrice < 0) {
                  newCompareAtPrice = 0;
                  console.log(`[Price Update] Compare-at price was negative, setting to 0`);
                }
              } else if (editType === 'setPriceToCostPercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const cost = variant.cost || 0;
                
                console.log(`[Price Update] Calculating price based on cost for variant ${variant.id}:`);
                console.log(`[Price Update] Cost: ${cost} MAD`);
                console.log(`[Price Update] Target percentage: ${percentage}%`);
                
                // Calculate the new price as a percentage of the cost
                // Formula: Price = Cost × (1 + Percentage / 100)
                // Example: If cost is 30 MAD and we want 50% markup:
                // price = 30 × (1 + 50/100) = 30 × 1.5 = 45 MAD
                newVariantPrice = Math.round((cost * (1 + percentage / 100)) * 100) / 100;
                
                console.log(`[Price Update] Calculated price: ${newVariantPrice} MAD`);
                console.log(`[Price Update] Verification: ${cost} × (1 + ${percentage/100}) = ${newVariantPrice} MAD`);
                
                // Ensure price doesn't go below 0
                if (newVariantPrice < 0) {
                  newVariantPrice = 0;
                  console.log(`[Price Update] Price was negative, setting to 0`);
                }
              } else if (editType === 'setPriceToCostAndShippingPercentage') {
                const percentage = parseFloat(adjustmentAmount);
                const shippingCost = parseFloat(formData.get("shippingCost") as string) || 0;
                const cost = variant.cost || 0;
                
                console.log(`[Price Update] Calculating price based on cost and shipping for variant ${variant.id}:`);
                console.log(`[Price Update] Cost: ${cost} MAD`);
                console.log(`[Price Update] Shipping Cost: ${shippingCost} MAD`);
                console.log(`[Price Update] Target percentage: ${percentage}%`);
                
                // Calculate the new price as a percentage of (cost + shipping)
                // Formula: Price = (Cost + Shipping) × (1 + Percentage / 100)
                // Example: If cost is 5 MAD, shipping is 2 MAD, and we want 10% markup:
                // price = (5 + 2) × (1 + 10/100) = 7 × 1.10 = 7.70 MAD
                newVariantPrice = Math.round(((cost + shippingCost) * (1 + percentage / 100)) * 100) / 100;
                
                console.log(`[Price Update] Calculated price: ${newVariantPrice} MAD`);
                console.log(`[Price Update] Verification: (${cost} + ${shippingCost}) × (1 + ${percentage/100}) = ${newVariantPrice} MAD`);
                
                // Ensure price doesn't go below 0
                if (newVariantPrice < 0) {
                  newVariantPrice = 0;
                  console.log(`[Price Update] Price was negative, setting to 0`);
                }
              } else {
                newVariantPrice = parseFloat(newPrice);
              }

              // Ensure the price is a valid number before converting to string
              if (isNaN(newVariantPrice)) {
                throw new Error(`Invalid price calculation for variant ${variant.id}`);
              }

              return {
                id: variant.id,
                ...(editType === 'setCompareAtPrice' 
                  ? { compareAtPrice: newPrice } 
                  : editType === 'adjustCompareAtPrice' || editType === 'adjustCompareAtPriceByPercentage' || 
                    editType === 'setCompareAtPriceToPricePercentage' || editType === 'setCompareAtPriceToCostPercentage'
                    ? { compareAtPrice: newCompareAtPrice?.toString() || '0' }
                    : editType === 'adjustPrice' || editType === 'adjustPriceByPercentage' || 
                      editType === 'setPriceToCompareAtPercentage' || editType === 'setPriceToCompareAtPercentageLess'
                      ? {
                          price: newVariantPrice.toString(),
                          ...(setCompareAtPriceToOriginal && { compareAtPrice: variant.price.toString() })
                        }
                      : { price: newVariantPrice.toString() }
                )
              };
            })
          };

          console.log('[Price Update] Updating prices with variables:', variables);
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

          console.log('[Price Update] Successfully updated prices for product:', productId);
        }

        console.log('[Price Update] All products updated successfully');
        return json({ 
          success: true,
          message: 'Product prices updated successfully'
        });
      } catch (error) {
        console.error('[Price Update] Detailed error:', error);
        return json({ 
          success: false,
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
              // Create a case-insensitive regex pattern
              const regex = new RegExp(textToAdd, 'gi');
              newTitle = currentTitle.replace(regex, '').trim();
              break;
            case 'replaceText':
              // Create a case-insensitive regex pattern for replacement
              const replaceRegex = new RegExp(textToAdd, 'gi');
              newTitle = currentTitle.replace(replaceRegex, replacementText);
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