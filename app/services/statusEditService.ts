/**
 * Status Edit Service
 * Handles bulk editing of product status
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk status editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleStatusEdit(request: Request, formData: FormData) {
  console.log('[StatusEditService] Starting status edit process');
  
  const { admin } = await authenticate.admin(request);
  console.log('[StatusEditService] Admin authenticated');

  // Log all form data for debugging
  console.log('[StatusEditService] Form data received:', {
    productIds: formData.get("productIds"),
    newStatus: formData.get("newStatus")
  });

  const productIds = JSON.parse(formData.get("productIds") as string);
  const newStatus = formData.get("newStatus") as string;

  console.log('[StatusEditService] Parsed data:', {
    productIds,
    newStatus
  });

  try {
    // Process each product
    console.log('[StatusEditService] Starting to process products');
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[StatusEditService] Processing product ${productId}`);
        
        // First get the current product status
        console.log(`[StatusEditService] Fetching current status for product ${productId}`);
        const getProductResponse = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              status
            }
          }`,
          {
            variables: {
              id: `gid://shopify/Product/${productId}`
            }
          }
        );

        const productData = await getProductResponse.json();
        console.log(`[StatusEditService] Current status for product ${productId}:`, productData.data.product.status);
        
        // Current status
        const currentStatus = productData.data.product.status;
        
        // Skip update if status is already the same
        if (currentStatus === newStatus) {
          console.log(`[StatusEditService] Product ${productId} already has status ${newStatus}, skipping update`);
          return {
            productId,
            originalStatus: currentStatus,
            newStatus: currentStatus,
            userErrors: [],
            skipped: true
          };
        }
        
        // Update the product status
        console.log(`[StatusEditService] Updating status from ${currentStatus} to ${newStatus} for product ${productId}`);
        const response = await admin.graphql(
          `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                status
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
                status: newStatus
              }
            }
          }
        );

        const responseJson = await response.json();
        console.log(`[StatusEditService] GraphQL response for product ${productId}:`, responseJson);

        if (responseJson.data?.productUpdate?.userErrors?.length > 0) {
          console.error(`[StatusEditService] Errors for product ${productId}:`, responseJson.data.productUpdate.userErrors);
        }

        return {
          ...responseJson.data.productUpdate,
          productId,
          originalStatus: currentStatus,
          newStatus: responseJson.data.productUpdate.product.status,
          skipped: false
        };
      })
    );

    // Check for any errors
    const errors = results.flatMap(result => result.userErrors);
    if (errors.length > 0) {
      console.error('[StatusEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some products: ${errors.map(e => e.message).join(', ')}`,
        success: false
      });
    }

    // Count updated and skipped products
    const updatedCount = results.filter(r => !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    
    console.log(`[StatusEditService] Status update completed: ${updatedCount} updated, ${skippedCount} skipped`);
    return json({
      success: true,
      message: `Status updated successfully! ${updatedCount} products updated, ${skippedCount} products skipped.`,
      results: results.map(result => ({
        productId: result.productId,
        originalStatus: result.originalStatus,
        newStatus: result.newStatus,
        skipped: result.skipped
      }))
    });
  } catch (error) {
    console.error('[StatusEditService] Error updating status:', error);
    return json({
      error: 'Failed to update product status',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 