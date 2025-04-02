/**
 * Vendor Edit Service
 * Handles bulk editing of product vendors
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk vendor editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleVendorEdit(request: Request, formData: FormData) {
  console.log('[VendorEditService] Starting vendor edit process');
  
  const { admin } = await authenticate.admin(request);
  console.log('[VendorEditService] Admin authenticated');

  // Log all form data for debugging
  console.log('[VendorEditService] Form data received:', {
    productIds: formData.get("productIds"),
    productVendors: formData.get("productVendors"),
    newVendor: formData.get("newVendor"),
    editType: formData.get("editType"),
    capitalizationType: formData.get("capitalizationType")
  });

  const productIds = JSON.parse(formData.get("productIds") as string);
  const productVendors = JSON.parse(formData.get("productVendors") as string);
  const newVendor = formData.get("newVendor") as string;
  const editType = formData.get("editType") as string;
  const capitalizationType = formData.get("capitalizationType") as string;

  console.log('[VendorEditService] Parsed data:', {
    productIds,
    productVendors,
    newVendor,
    editType,
    capitalizationType
  });

  try {
    // Process each product
    console.log('[VendorEditService] Starting to process products');
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[VendorEditService] Processing product ${productId}`);
        const originalVendor = productVendors[productId];
        let updatedVendor = originalVendor;

        if (editType === 'updateVendor') {
          console.log(`[VendorEditService] Updating vendor to: ${newVendor}`);
          updatedVendor = newVendor;
        } else if (editType === 'capitalizeVendor') {
          console.log(`[VendorEditService] Applying capitalization: ${capitalizationType}`);
          updatedVendor = applyCapitalization(originalVendor, capitalizationType);
        }

        console.log(`[VendorEditService] Original vendor: ${originalVendor}, Updated vendor: ${updatedVendor}`);

        // Update the product
        console.log(`[VendorEditService] Sending GraphQL mutation for product ${productId}`);
        const response = await admin.graphql(
          `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                vendor
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
                vendor: updatedVendor
              }
            }
          }
        );

        const responseJson = await response.json();
        console.log(`[VendorEditService] GraphQL response for product ${productId}:`, responseJson);

        if (responseJson.data?.productUpdate?.userErrors?.length > 0) {
          console.error(`[VendorEditService] Errors for product ${productId}:`, responseJson.data.productUpdate.userErrors);
        }

        return responseJson.data.productUpdate;
      })
    );

    // Check for any errors
    const errors = results.flatMap(result => result.userErrors);
    if (errors.length > 0) {
      console.error('[VendorEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some products: ${errors.map(e => e.message).join(', ')}`,
        success: false
      });
    }

    console.log('[VendorEditService] All products updated successfully');
    return json({
      success: true,
      message: 'Vendors updated successfully!'
    });
  } catch (error) {
    console.error('[VendorEditService] Error updating vendors:', error);
    return json({
      error: 'Failed to update vendors',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Applies the specified capitalization to a string
 * @param text - The text to capitalize
 * @param type - The type of capitalization to apply
 * @returns The capitalized text
 */
function applyCapitalization(text: string, type: string): string {
  console.log(`[VendorEditService] Applying capitalization type ${type} to text: ${text}`);
  
  let result: string;
  switch (type) {
    case 'titleCase':
      result = text.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      break;
    case 'uppercase':
      result = text.toUpperCase();
      break;
    case 'lowercase':
      result = text.toLowerCase();
      break;
    case 'firstLetter':
      result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      break;
    default:
      result = text;
  }
  
  console.log(`[VendorEditService] Capitalization result: ${result}`);
  return result;
} 