/**
 * Product Type Edit Service
 * Handles bulk editing of product type
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk product type editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleProductTypeEdit(request: Request, formData: FormData) {
  console.log('[ProductTypeEditService] Starting product type edit process');
  
  const { admin } = await authenticate.admin(request);
  console.log('[ProductTypeEditService] Admin authenticated');

  // Log all form data for debugging
  console.log('[ProductTypeEditService] Form data received:', {
    productIds: formData.get("productIds"),
    newProductType: formData.get("newProductType")
  });

  const productIds = JSON.parse(formData.get("productIds") as string);
  const newProductType = formData.get("newProductType") as string;

  console.log('[ProductTypeEditService] Parsed data:', {
    productIds,
    newProductType
  });

  try {
    // Process each product
    console.log('[ProductTypeEditService] Starting to process products');
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[ProductTypeEditService] Processing product ${productId}`);
        
        // First get the current product type
        console.log(`[ProductTypeEditService] Fetching current product type for product ${productId}`);
        const getProductResponse = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              productType
            }
          }`,
          {
            variables: {
              id: `gid://shopify/Product/${productId}`
            }
          }
        );

        const productData = await getProductResponse.json();
        console.log(`[ProductTypeEditService] Current product type for product ${productId}:`, productData.data.product.productType);
        
        // Current product type
        const currentProductType = productData.data.product.productType;
        
        // Skip update if product type is already the same
        if (currentProductType === newProductType) {
          console.log(`[ProductTypeEditService] Product ${productId} already has product type ${newProductType}, skipping update`);
          return {
            productId,
            originalProductType: currentProductType,
            newProductType: currentProductType,
            userErrors: [],
            skipped: true
          };
        }
        
        // Update the product type
        console.log(`[ProductTypeEditService] Updating product type from ${currentProductType} to ${newProductType} for product ${productId}`);
        const response = await admin.graphql(
          `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                productType
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              input: {
                id: `gid://shopify/Product/${productId}`,
                productType: newProductType
              }
            }
          }
        );

        const responseJson = await response.json();
        console.log(`[ProductTypeEditService] GraphQL response for product ${productId}:`, responseJson);

        if (responseJson.data?.productUpdate?.userErrors?.length > 0) {
          console.error(`[ProductTypeEditService] Errors for product ${productId}:`, responseJson.data.productUpdate.userErrors);
        }

        return {
          ...responseJson.data.productUpdate,
          productId,
          originalProductType: currentProductType,
          newProductType: responseJson.data.productUpdate.product.productType,
          skipped: false
        };
      })
    );

    // Check for any errors
    const errors = results.flatMap(result => result.userErrors);
    if (errors.length > 0) {
      console.error('[ProductTypeEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some products: ${errors.map(e => e.message).join(', ')}`,
        success: false
      });
    }

    // Count updated and skipped products
    const updatedCount = results.filter(r => !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    
    console.log(`[ProductTypeEditService] Product type update completed: ${updatedCount} updated, ${skippedCount} skipped`);
    return json({
      success: true,
      message: `Product type updated successfully! ${updatedCount} products updated, ${skippedCount} products skipped.`,
      results: results.map(result => ({
        productId: result.productId,
        originalProductType: result.originalProductType,
        newProductType: result.newProductType,
        skipped: result.skipped
      }))
    });
  } catch (error) {
    console.error('[ProductTypeEditService] Error updating product type:', error);
    return json({
      error: 'Failed to update product type',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 