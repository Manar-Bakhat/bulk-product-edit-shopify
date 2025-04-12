/**
 * Variant Requires Shipping Service
 * Service for handling bulk editing of product variant shipping requirements status
 * 
 * @author Manar Bakhat
*/

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

interface GraphQLResponse {
  data?: {
    product?: {
      id: string;
      title: string;
      variants?: {
        edges: Array<{
          node: {
            id: string;
            title: string;
            inventoryItem: {
              id: string;
              requiresShipping: boolean;
            };
          };
        }>;
      };
    };
    productVariantUpdate?: {
      productVariant: {
        id: string;
        inventoryItem: {
          id: string;
          requiresShipping: boolean;
        };
      };
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

export async function handleVariantRequiresShippingEdit(request: Request, formData: FormData) {
  console.log('[VariantRequiresShippingService] Starting shipping requirements edit process');
  
  const { admin, session } = await authenticate.admin(request);
  
  // Extract form data
  const requiresShipping = formData.get("requiresShipping") as string;
  const productIdsStr = formData.get("productIds") as string;
  
  // Validate inputs
  if (requiresShipping !== 'true' && requiresShipping !== 'false') {
    console.error('[VariantRequiresShippingService] Invalid requires shipping value');
    return json({ success: false, error: 'Invalid shipping requirement value. Must be either "true" or "false".' });
  }
  
  if (!productIdsStr) {
    console.error('[VariantRequiresShippingService] No products selected');
    return json({ success: false, error: 'No products selected' });
  }
  
  // Parse product IDs
  let productIds: string[] = [];
  try {
    productIds = JSON.parse(productIdsStr);
  } catch (error) {
    console.error('[VariantRequiresShippingService] Error parsing product IDs:', error);
    return json({ success: false, error: 'Invalid product IDs format' });
  }
  
  if (productIds.length === 0) {
    console.error('[VariantRequiresShippingService] No products selected (empty array)');
    return json({ success: false, error: 'No products selected' });
  }
  
  const requiresShippingValue = requiresShipping === 'true';
  console.log(`[VariantRequiresShippingService] Processing ${productIds.length} products, setting requires shipping to ${requiresShippingValue ? 'enabled' : 'disabled'}`);
  
  // Fallback REST API method for updating requires shipping
  async function fallbackUpdateRequiresShipping(variantId: string, requiresShippingValue: boolean) {
    try {
      // Extract numeric ID from the Shopify gid format
      const numericId = variantId.split('/').pop() || '';
      if (!numericId) {
        throw new Error('Invalid variant ID format');
      }

      console.log(`[VariantRequiresShippingService] Using REST API to update variant ${numericId} requires shipping to ${requiresShippingValue}`);
      
      const shop = session.shop;
      const token = session.accessToken;
      
      if (!token) {
        throw new Error('Shopify access token not available');
      }
      
      // Update the variant directly
      const updateResponse = await fetch(
        `https://${shop}/admin/api/2023-10/variants/${numericId}.json`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          },
          body: JSON.stringify({
            variant: {
              id: numericId,
              inventory_management: "shopify", // Ensure inventory is tracked
              inventory_item: {
                requires_shipping: requiresShippingValue
              }
            }
          })
        }
      );
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`REST API shipping update failed: ${JSON.stringify(errorData)}`);
      }
      
      const updateData = await updateResponse.json();
      console.log(`[VariantRequiresShippingService] REST API response:`, updateData);
      
      return {
        success: true,
        variantId: variantId,
        newRequiresShipping: updateData.variant.inventory_item?.requires_shipping || requiresShippingValue
      };
    } catch (error) {
      console.error(`[VariantRequiresShippingService] REST API fallback failed:`, error);
      return {
        success: false,
        variantId: variantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  try {
    // Process all products
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[VariantRequiresShippingService] Processing product ${productId}`);
        
        // First get the current product variants
        console.log(`[VariantRequiresShippingService] Fetching variants for product ${productId}`);
        const getProductResponse = await admin.graphql(
          `#graphql
          query getProductVariants($id: ID!) {
            product(id: $id) {
              id
              title
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    inventoryItem {
                      id
                      requiresShipping
                    }
                  }
                }
              }
            }
          }`,
          {
            variables: {
              id: `gid://shopify/Product/${productId}`
            }
          }
        );

        const productData = await getProductResponse.json() as GraphQLResponse;
        console.log('[VariantRequiresShippingService] GraphQL response:', productData);
        
        if (productData.errors) {
          console.error('[VariantRequiresShippingService] GraphQL errors:', productData.errors);
          return {
            productId,
            success: false,
            userErrors: productData.errors,
            skipped: false
          };
        }
        
        if (!productData.data?.product) {
          console.error(`[VariantRequiresShippingService] Product ${productId} not found`);
          return {
            productId,
            success: false,
            userErrors: [{ message: 'Product not found' }],
            skipped: true
          };
        }
        
        const productTitle = productData.data.product.title;
        const variants = productData.data.product.variants?.edges?.map(edge => edge.node) || [];
        
        // Skip product if it has no variants
        if (variants.length === 0) {
          console.log(`[VariantRequiresShippingService] Product ${productId} has no variants, skipping`);
          return {
            productId,
            productTitle,
            success: false,
            userErrors: [{ message: 'No variants found' }],
            skipped: true
          };
        }
        
        console.log(`[VariantRequiresShippingService] Found ${variants.length} variants for product ${productId}`);
        
        // Process each variant
        const variantUpdates = await Promise.all(
          variants.map(async (variant: any) => {
            try {
              if (!variant.id) {
                console.log(`[VariantRequiresShippingService] Variant has no ID, skipping`);
                return {
                  variantId: "unknown",
                  success: false,
                  error: 'No variant ID found',
                  skipped: true
                };
              }
              
              const variantId = variant.id;
              const currentRequiresShipping = variant.inventoryItem?.requiresShipping;
              
              // Handle case where inventoryItem is missing
              if (variant.inventoryItem === null || variant.inventoryItem === undefined) {
                console.log(`[VariantRequiresShippingService] Variant ${variantId} has no inventory item, skipping`);
                return {
                  variantId: variantId,
                  success: false,
                  error: 'No inventory item found',
                  skipped: true
                };
              }
              
              // Skip update if the shipping requirement is already set to the desired value
              if (currentRequiresShipping === requiresShippingValue) {
                console.log(`[VariantRequiresShippingService] Variant ${variantId} already has requires shipping set to ${requiresShippingValue}, skipping`);
                return {
                  variantId: variantId,
                  success: true,
                  originalRequiresShipping: currentRequiresShipping,
                  newRequiresShipping: currentRequiresShipping,
                  skipped: true
                };
              }
              
              console.log(`[VariantRequiresShippingService] Processing variant ${variantId}, current requires shipping: ${currentRequiresShipping}, new value: ${requiresShippingValue}`);
              
              try {
                // Update variant shipping requirement using GraphQL
                const updateResponse = await admin.graphql(
                  `#graphql
                  mutation productVariantUpdate($input: ProductVariantInput!) {
                    productVariantUpdate(input: $input) {
                      productVariant {
                        id
                        inventoryItem {
                          id
                          requiresShipping
                        }
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
                        id: variantId,
                        inventoryItem: {
                          requiresShipping: requiresShippingValue
                        }
                      }
                    }
                  }
                );
                
                const updateData = await updateResponse.json() as GraphQLResponse;
                console.log('[VariantRequiresShippingService] Update response:', updateData);
                
                if (updateData.errors) {
                  console.error('[VariantRequiresShippingService] GraphQL errors during update:', updateData.errors);
                  throw new Error(updateData.errors[0]?.message || 'GraphQL update failed');
                }
                
                if (updateData.data?.productVariantUpdate?.userErrors && 
                    updateData.data.productVariantUpdate.userErrors.length > 0) {
                  console.error('[VariantRequiresShippingService] User errors during update:', updateData.data.productVariantUpdate.userErrors);
                  throw new Error(updateData.data.productVariantUpdate.userErrors[0]?.message || 'Update failed with user errors');
                }
                
                const newRequiresShipping = updateData.data?.productVariantUpdate?.productVariant?.inventoryItem?.requiresShipping;
                
                return {
                  variantId: variantId,
                  variantTitle: variant.title,
                  success: true,
                  originalRequiresShipping: currentRequiresShipping,
                  newRequiresShipping: newRequiresShipping,
                  skipped: false
                };
              } catch (graphqlError) {
                console.error(`[VariantRequiresShippingService] GraphQL update failed for variant ${variantId}, trying REST fallback:`, graphqlError);
                
                // Try REST API as fallback
                const fallbackResult = await fallbackUpdateRequiresShipping(variantId, requiresShippingValue);
                
                if (fallbackResult.success) {
                  return {
                    variantId: variantId,
                    variantTitle: variant.title,
                    success: true,
                    originalRequiresShipping: currentRequiresShipping,
                    newRequiresShipping: fallbackResult.newRequiresShipping,
                    usedFallback: true
                  };
                } else {
                  throw new Error(fallbackResult.error || 'Both GraphQL and REST API updates failed');
                }
              }
            } catch (error) {
              console.error(`[VariantRequiresShippingService] Error processing variant ${variant.id}:`, error);
              return {
                variantId: variant.id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                skipped: false
              };
            }
          })
        );
        
        // Check results
        const successfulUpdates = variantUpdates.filter(update => update.success && !update.skipped);
        const failedUpdates = variantUpdates.filter(update => !update.success);
        
        console.log(`[VariantRequiresShippingService] Product ${productId} update complete. Success: ${successfulUpdates.length}, Failed: ${failedUpdates.length}`);
        
        return {
          productId,
          productTitle,
          success: successfulUpdates.length > 0,
          variantUpdates,
          skipped: false
        };
      })
    );
    
    // Compile statistics
    const successfulProducts = results.filter(result => result.success);
    const skippedProducts = results.filter(result => result.skipped);
    const failedProducts = results.filter(result => !result.success && !result.skipped);
    
    const allVariantUpdates = results.flatMap(result => 
      result.variantUpdates ? result.variantUpdates : []
    );
    
    const successfulVariants = allVariantUpdates.filter(update => update.success && !update.skipped);
    const failedVariants = allVariantUpdates.filter(update => !update.success);
    const skippedVariants = allVariantUpdates.filter(update => update.skipped);
    
    console.log(`[VariantRequiresShippingService] All products processed. Success: ${successfulProducts.length}, Failed: ${failedProducts.length}, Skipped: ${skippedProducts.length}`);
    console.log(`[VariantRequiresShippingService] All variants processed. Success: ${successfulVariants.length}, Failed: ${failedVariants.length}, Skipped: ${skippedVariants.length}`);
    
    if (successfulVariants.length === 0 && skippedVariants.length === 0) {
      // If all updates failed, return a more informative error
      const errors = failedVariants
        .map(v => v.error)
        .filter(Boolean);
      
      const uniqueErrors = [...new Set(errors)];
      
      return json({
        error: uniqueErrors.length > 0 
          ? `Failed to update shipping requirements: ${uniqueErrors.join(', ')}` 
          : 'Failed to update shipping requirements for all variants',
        success: false
      });
    }
    
    // Partial failure case
    if (failedVariants.length > 0 && successfulVariants.length > 0) {
      return json({
        success: true,
        partialFailure: true,
        message: `Updated shipping requirements for ${successfulVariants.length} variants across ${successfulProducts.length} products. ${failedVariants.length} variants failed to update.`,
        error: 'Some variants could not be updated'
      });
    }
    
    // Full success (including cases where some variants were skipped because they already had the right setting)
    return json({
      success: true,
      message: `Shipping requirements ${requiresShippingValue ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error) {
    console.error('[VariantRequiresShippingService] Error:', error);
    return json({
      error: 'An error occurred while updating shipping requirements',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 