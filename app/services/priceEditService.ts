/**
 * @author Manar Bakhat
*/

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

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
    productVariantsBulkUpdate?: {
      variants: Array<{
        id: string;
        price: string;
        compareAtPrice?: string | null;
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

export async function handlePriceEdit(request: Request, formData: FormData) {
  const { admin } = await authenticate.admin(request);
  const productIds = formData.get("productIds") as string;
  const productIdsArray = JSON.parse(productIds);
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
    validatePriceEditInputs(editType, adjustmentType, adjustmentAmount);

    // Update each product's price sequentially
    for (const productId of productIdsArray) {
      await updateProductPrice(admin, productId, editType, newPrice, adjustmentType, adjustmentAmount, setCompareAtPriceToOriginal, formData);
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
}

function validatePriceEditInputs(editType: string, adjustmentType: string | null, adjustmentAmount: string | null) {
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
}

async function updateProductPrice(
  admin: any,
  productId: string,
  editType: string,
  newPrice: string,
  adjustmentType: string | null,
  adjustmentAmount: string | null,
  setCompareAtPriceToOriginal: boolean,
  formData: FormData
) {
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
        const adjustment = parseFloat(adjustmentAmount || '0');
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
        const percentage = parseFloat(adjustmentAmount || '0');
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
        const adjustment = parseFloat(adjustmentAmount || '0');
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
        const percentage = parseFloat(adjustmentAmount || '0');
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
        const percentage = parseFloat(adjustmentAmount || '0');
        const compareAtPrice = variant.compareAtPrice || variant.price;
        
        // Set the new price to the specified percentage of the compare-at price
        newVariantPrice = compareAtPrice * (percentage / 100);
        
        // Ensure price doesn't go below 0
        if (newVariantPrice < 0) {
          newVariantPrice = 0;
        }
      } else if (editType === 'setPriceToCompareAtPercentageLess') {
        const percentage = parseFloat(adjustmentAmount || '0');
        const compareAtPrice = variant.compareAtPrice || variant.price;
        
        // Calculate the new price by subtracting the percentage from the compare-at price
        newVariantPrice = compareAtPrice - (compareAtPrice * (percentage / 100));
        
        // Ensure price doesn't go below 0
        if (newVariantPrice < 0) {
          newVariantPrice = 0;
        }
      } else if (editType === 'setCompareAtPriceToPricePercentage') {
        const percentage = parseFloat(adjustmentAmount || '0');
        const currentPrice = variant.price;
        
        // Calculate the new compare-at price so that the current price is lower by the specified percentage
        newCompareAtPrice = Math.round((currentPrice / (1 - percentage / 100)) * 100) / 100;
        
        // Ensure compare-at price doesn't go below 0
        if (newCompareAtPrice < 0) {
          newCompareAtPrice = 0;
        }
      } else if (editType === 'setCompareAtPriceToCostPercentage') {
        const percentage = parseFloat(adjustmentAmount || '0');
        const cost = variant.cost || 0;
        
        // Calculate the new compare-at price as a percentage of the cost
        newCompareAtPrice = Math.round((cost * (1 + percentage / 100)) * 100) / 100;
        
        // Ensure compare-at price doesn't go below 0
        if (newCompareAtPrice < 0) {
          newCompareAtPrice = 0;
        }
      } else if (editType === 'setPriceToCostPercentage') {
        const percentage = parseFloat(adjustmentAmount || '0');
        const cost = variant.cost || 0;
        
        // Calculate the new price as a percentage of the cost
        newVariantPrice = Math.round((cost * (1 + percentage / 100)) * 100) / 100;
        
        // Ensure price doesn't go below 0
        if (newVariantPrice < 0) {
          newVariantPrice = 0;
        }
      } else if (editType === 'setPriceToCostAndShippingPercentage') {
        const percentage = parseFloat(adjustmentAmount || '0');
        const shippingCost = parseFloat(formData.get("shippingCost") as string) || 0;
        const cost = variant.cost || 0;
        
        // Calculate the new price as a percentage of (cost + shipping)
        newVariantPrice = Math.round(((cost + shippingCost) * (1 + percentage / 100)) * 100) / 100;
        
        // Ensure price doesn't go below 0
        if (newVariantPrice < 0) {
          newVariantPrice = 0;
        }
      } else if (editType === 'removeCompareAtPrice') {
        // Set compare-at price to null to remove it
        newCompareAtPrice = null;
      } else if (editType === 'roundPrice') {
        const roundingType = formData.get("roundingType") as string;
        const roundingValue = parseInt(formData.get("roundingValue") as string);
        const currentPrice = parseFloat(variant.price.toString());
        
        // Get the integer part of the price
        const integerPart = Math.floor(currentPrice);
        
        // Calculate the new price based on rounding type
        let roundedPrice: number;
        switch (roundingType) {
          case 'upper':
            roundedPrice = Math.ceil(integerPart / roundingValue) * roundingValue;
            break;
          case 'lower':
            roundedPrice = Math.floor(integerPart / roundingValue) * roundingValue;
            break;
          case 'nearest':
            roundedPrice = Math.round(integerPart / roundingValue) * roundingValue;
            break;
          default:
            roundedPrice = currentPrice;
        }
        
        // Ensure price doesn't go below 0
        if (roundedPrice < 0) {
          roundedPrice = 0;
        }

        // Set the new price
        newVariantPrice = roundedPrice;
      } else if (editType === 'roundCompareAtPrice') {
        const roundingType = formData.get("roundingType") as string;
        const roundingValue = parseInt(formData.get("roundingValue") as string);
        const currentCompareAtPrice = variant.compareAtPrice ? parseFloat(variant.compareAtPrice.toString()) : 0;
        
        // Get the integer part of the compare-at price
        const integerPart = Math.floor(currentCompareAtPrice);
        
        // Calculate the new compare-at price based on rounding type
        let roundedCompareAtPrice: number;
        switch (roundingType) {
          case 'upper':
            roundedCompareAtPrice = Math.ceil(integerPart / roundingValue) * roundingValue;
            break;
          case 'lower':
            roundedCompareAtPrice = Math.floor(integerPart / roundingValue) * roundingValue;
            break;
          case 'nearest':
            roundedCompareAtPrice = Math.round(integerPart / roundingValue) * roundingValue;
            break;
          default:
            roundedCompareAtPrice = currentCompareAtPrice;
        }
        
        // Ensure compare-at price doesn't go below 0
        if (roundedCompareAtPrice < 0) {
          roundedCompareAtPrice = 0;
        }

        // Set the new compare-at price
        newCompareAtPrice = roundedCompareAtPrice;
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
            editType === 'setCompareAtPriceToPricePercentage' || editType === 'setCompareAtPriceToCostPercentage' ||
            editType === 'roundCompareAtPrice'
            ? { compareAtPrice: newCompareAtPrice?.toString() || '0' }
            : editType === 'removeCompareAtPrice'
            ? { compareAtPrice: null }
            : editType === 'roundPrice'
            ? { price: newVariantPrice.toString() }
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