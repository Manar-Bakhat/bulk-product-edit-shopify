/**
 * Variant Tracks Inventory Service
 * Service for handling bulk editing of product variant inventory tracking status
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
            inventoryItem?: {
              id: string;
              tracked: boolean;
            } | null;
          };
        }>;
      };
    };
    inventoryItemUpdate?: {
      inventoryItem: {
        id: string;
        tracked: boolean;
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

export async function handleVariantTracksInventoryEdit(request: Request, formData: FormData) {
  console.log('[VariantTracksInventoryService] Starting inventory tracking edit process');
  
  const { admin, session } = await authenticate.admin(request);
  
  // Extract form data
  const tracksInventory = formData.get("tracksInventory") as string;
  const productIdsStr = formData.get("productIds") as string;
  
  // Validate inputs
  if (tracksInventory !== 'true' && tracksInventory !== 'false') {
    console.error('[VariantTracksInventoryService] Invalid tracks inventory value');
    return json({ success: false, error: 'Invalid inventory tracking value. Must be either "true" or "false".' });
  }
  
  if (!productIdsStr) {
    console.error('[VariantTracksInventoryService] No products selected');
    return json({ success: false, error: 'No products selected' });
  }
  
  // Parse product IDs
  let productIds: string[] = [];
  try {
    productIds = JSON.parse(productIdsStr);
  } catch (error) {
    console.error('[VariantTracksInventoryService] Error parsing product IDs:', error);
    return json({ success: false, error: 'Invalid product IDs format' });
  }
  
  if (productIds.length === 0) {
    console.error('[VariantTracksInventoryService] No products selected (empty array)');
    return json({ success: false, error: 'No products selected' });
  }
  
  const trackingEnabled = tracksInventory === 'true';
  console.log(`[VariantTracksInventoryService] Processing ${productIds.length} products, setting tracking to ${trackingEnabled ? 'enabled' : 'disabled'}`);
  
  // Fallback REST API method for updating inventory tracking
  async function fallbackUpdateInventoryTracking(variantId: string, tracked: boolean) {
    try {
      // Extract numeric ID from the Shopify gid format
      const numericId = variantId.split('/').pop() || '';
      if (!numericId) {
        throw new Error('Invalid variant ID format');
      }

      console.log(`[VariantTracksInventoryService] Using REST API to update variant ${numericId} tracking to ${tracked}`);
      
      const shop = session.shop;
      const token = session.accessToken;
      
      if (!token) {
        throw new Error('Shopify access token not available');
      }
      
      // First get the variant information to get the inventory_item_id
      const getVariantResponse = await fetch(
        `https://${shop}/admin/api/2023-10/variants/${numericId}.json`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          }
        }
      );
      
      if (!getVariantResponse.ok) {
        const errorData = await getVariantResponse.json();
        throw new Error(`REST API request failed: ${JSON.stringify(errorData)}`);
      }
      
      const variantData = await getVariantResponse.json();
      const inventoryItemId = variantData.variant.inventory_item_id;
      
      if (!inventoryItemId) {
        throw new Error('No inventory item ID found for variant');
      }
      
      console.log(`[VariantTracksInventoryService] Found inventory item ID ${inventoryItemId} for variant ${numericId}`);
      
      // Update the inventory item tracking
      const updateResponse = await fetch(
        `https://${shop}/admin/api/2023-10/inventory_items/${inventoryItemId}.json`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          },
          body: JSON.stringify({
            inventory_item: {
              id: inventoryItemId,
              tracked: tracked
            }
          })
        }
      );
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`REST API tracking update failed: ${JSON.stringify(errorData)}`);
      }
      
      const updateData = await updateResponse.json();
      console.log(`[VariantTracksInventoryService] REST API response:`, updateData);
      
      return {
        success: true,
        variantId: variantId,
        newTracked: updateData.inventory_item.tracked
      };
    } catch (error) {
      console.error(`[VariantTracksInventoryService] REST API fallback also failed:`, error);
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
        console.log(`[VariantTracksInventoryService] Processing product ${productId}`);
        
        // First get the current product variants
        console.log(`[VariantTracksInventoryService] Fetching variants for product ${productId}`);
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
                      tracked
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
        console.log('[VariantTracksInventoryService] GraphQL response:', productData);
        
        if (productData.errors) {
          console.error('[VariantTracksInventoryService] GraphQL errors:', productData.errors);
          return {
            productId,
            success: false,
            userErrors: productData.errors,
            skipped: false
          };
        }
        
        if (!productData.data?.product) {
          console.error(`[VariantTracksInventoryService] Product ${productId} not found`);
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
          console.log(`[VariantTracksInventoryService] Product ${productId} has no variants, skipping`);
          return {
            productId,
            productTitle,
            success: false,
            userErrors: [{ message: 'No variants found' }],
            skipped: true
          };
        }
        
        console.log(`[VariantTracksInventoryService] Found ${variants.length} variants for product ${productId}`);
        
        // Process each variant
        const variantUpdates = await Promise.all(
          variants.map(async (variant: any) => {
            try {
              if (!variant.inventoryItem?.id) {
                console.log(`[VariantTracksInventoryService] Variant ${variant.id} has no inventory item, skipping`);
                return {
                  variantId: variant.id,
                  success: false,
                  error: 'No inventory item found',
                  skipped: true
                };
              }
              
              const inventoryItemId = variant.inventoryItem.id;
              const currentTracked = variant.inventoryItem?.tracked;
              
              // Skip update if the tracking status is already set to the desired value
              if (currentTracked === trackingEnabled) {
                console.log(`[VariantTracksInventoryService] Variant ${variant.id} already has tracking set to ${trackingEnabled}, skipping`);
                return {
                  variantId: variant.id,
                  success: true,
                  originalTracked: currentTracked,
                  newTracked: currentTracked,
                  skipped: true
                };
              }
              
              console.log(`[VariantTracksInventoryService] Processing variant ${variant.id}, current tracking: ${currentTracked}, new tracking: ${trackingEnabled}`);
              
              try {
                // Update inventory item tracking using GraphQL
                const updateResponse = await admin.graphql(
                  `#graphql
                  mutation inventoryItemUpdate($input: InventoryItemUpdateInput!) {
                    inventoryItemUpdate(input: $input) {
                      inventoryItem {
                        id
                        tracked
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
                        id: inventoryItemId,
                        tracked: trackingEnabled
                      }
                    }
                  }
                );
                
                const updateData = await updateResponse.json() as GraphQLResponse;
                console.log('[VariantTracksInventoryService] Update response:', updateData);
                
                if (updateData.errors) {
                  console.error('[VariantTracksInventoryService] GraphQL errors during update:', updateData.errors);
                  throw new Error(updateData.errors[0]?.message || 'GraphQL update failed');
                }
                
                if (updateData.data?.inventoryItemUpdate?.userErrors && 
                    updateData.data.inventoryItemUpdate.userErrors.length > 0) {
                  console.error('[VariantTracksInventoryService] User errors during update:', updateData.data.inventoryItemUpdate.userErrors);
                  throw new Error(updateData.data.inventoryItemUpdate.userErrors[0]?.message || 'Update failed with user errors');
                }
                
                const newTracked = updateData.data?.inventoryItemUpdate?.inventoryItem?.tracked;
                
                return {
                  variantId: variant.id,
                  variantTitle: variant.title,
                  success: true,
                  originalTracked: currentTracked,
                  newTracked: newTracked,
                  skipped: false
                };
              } catch (graphqlError) {
                console.error(`[VariantTracksInventoryService] GraphQL update failed for variant ${variant.id}, trying REST fallback:`, graphqlError);
                
                // Try REST API as fallback
                const fallbackResult = await fallbackUpdateInventoryTracking(variant.id, trackingEnabled);
                
                if (fallbackResult.success) {
                  return {
                    variantId: variant.id,
                    variantTitle: variant.title,
                    success: true,
                    originalTracked: currentTracked,
                    newTracked: fallbackResult.newTracked,
                    usedFallback: true
                  };
                } else {
                  throw new Error(fallbackResult.error || 'Both GraphQL and REST API updates failed');
                }
              }
            } catch (error) {
              console.error(`[VariantTracksInventoryService] Error processing variant ${variant.id}:`, error);
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
        
        console.log(`[VariantTracksInventoryService] Product ${productId} update complete. Success: ${successfulUpdates.length}, Failed: ${failedUpdates.length}`);
        
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
    
    console.log(`[VariantTracksInventoryService] All products processed. Success: ${successfulProducts.length}, Failed: ${failedProducts.length}, Skipped: ${skippedProducts.length}`);
    console.log(`[VariantTracksInventoryService] All variants processed. Success: ${successfulVariants.length}, Failed: ${failedVariants.length}, Skipped: ${skippedVariants.length}`);
    
    if (successfulVariants.length === 0 && skippedVariants.length === 0) {
      // If all updates failed, return a more informative error
      const errors = failedVariants
        .map(v => v.error)
        .filter(Boolean);
      
      const uniqueErrors = [...new Set(errors)];
      
      return json({
        error: uniqueErrors.length > 0 
          ? `Failed to update inventory tracking: ${uniqueErrors.join(', ')}` 
          : 'Failed to update inventory tracking for all variants',
        success: false
      });
    }
    
    // Partial failure case
    if (failedVariants.length > 0 && successfulVariants.length > 0) {
      return json({
        success: true,
        partialFailure: true,
        message: `Updated inventory tracking for ${successfulVariants.length} variants across ${successfulProducts.length} products. ${failedVariants.length} variants failed to update.`,
        error: 'Some variants could not be updated'
      });
    }
    
    // Full success (including cases where some variants were skipped because they already had the right tracking setting)
    return json({
      success: true,
      message: `Inventory tracking ${trackingEnabled ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error) {
    console.error('[VariantTracksInventoryService] Error:', error);
    return json({
      error: 'An error occurred while updating inventory tracking',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 