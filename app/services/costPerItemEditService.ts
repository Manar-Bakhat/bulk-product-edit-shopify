/**
 * Cost Per Item Edit Service
 * Service for handling bulk editing of product item costs
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
              unitCost?: {
                amount: string;
                currencyCode: string;
              } | null;
            } | null;
          };
        }>;
      };
    };
    inventoryItemUpdate?: {
      inventoryItem: {
        id: string;
        unitCost: {
          amount: string;
          currencyCode: string;
        } | null;
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

export async function handleCostPerItemEdit(request: Request, formData: FormData) {
  console.log('[CostPerItemService] Starting cost per item edit process');
  
  const { admin, session } = await authenticate.admin(request);
  
  // Extract form data
  const action = formData.get("action") as string;
  const costValue = formData.get("costValue") as string;
  const productIdsStr = formData.get("productIds") as string;
  
  // Validate inputs
  if (!action) {
    console.error('[CostPerItemService] No action specified');
    return json({ success: false, error: 'No action specified' });
  }
  
  if (!costValue) {
    console.error('[CostPerItemService] No cost value specified');
    return json({ success: false, error: 'No cost value specified' });
  }
  
  if (!productIdsStr) {
    console.error('[CostPerItemService] No products selected');
    return json({ success: false, error: 'No products selected' });
  }
  
  // Parse product IDs
  let productIds: string[] = [];
  try {
    productIds = JSON.parse(productIdsStr);
  } catch (error) {
    console.error('[CostPerItemService] Error parsing product IDs:', error);
    return json({ success: false, error: 'Invalid product IDs format' });
  }
  
  if (productIds.length === 0) {
    console.error('[CostPerItemService] No products selected (empty array)');
    return json({ success: false, error: 'No products selected' });
  }
  
  console.log(`[CostPerItemService] Processing ${productIds.length} products with action: ${action}, cost value: ${costValue}`);
  
  // Fallback REST API method for updating cost
  async function fallbackUpdateVariantCost(variantId: string, cost: string) {
    try {
      // Extract numeric ID from the Shopify gid format
      const numericId = variantId.split('/').pop() || '';
      if (!numericId) {
        throw new Error('Invalid variant ID format');
      }

      console.log(`[CostPerItemService] Using REST API to update variant ${numericId} cost to ${cost}`);
      
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
      
      console.log(`[CostPerItemService] Found inventory item ID ${inventoryItemId} for variant ${numericId}`);
      
      // Update the inventory item cost
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
              cost: parseFloat(cost)
            }
          })
        }
      );
      
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(`REST API cost update failed: ${JSON.stringify(errorData)}`);
      }
      
      const updateData = await updateResponse.json();
      console.log(`[CostPerItemService] REST API response:`, updateData);
      
      return {
        success: true,
        variantId: variantId,
        newCost: updateData.inventory_item.cost
      };
    } catch (error) {
      console.error(`[CostPerItemService] REST API fallback also failed:`, error);
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
        console.log(`[CostPerItemService] Processing product ${productId}`);
        
        // First get the current product variants
        console.log(`[CostPerItemService] Fetching variants for product ${productId}`);
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
                      unitCost {
                        amount
                        currencyCode
                      }
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

        const productData = await getProductResponse.json();
        console.log('[CostPerItemService] GraphQL response:', productData);
        
        if (productData.errors) {
          console.error('[CostPerItemService] GraphQL errors:', productData.errors);
          return {
            productId,
            success: false,
            userErrors: productData.errors,
            skipped: false
          };
        }
        
        if (!productData.data?.product) {
          console.error(`[CostPerItemService] Product ${productId} not found`);
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
          console.log(`[CostPerItemService] Product ${productId} has no variants, skipping`);
          return {
            productId,
            productTitle,
            success: false,
            userErrors: [{ message: 'No variants found' }],
            skipped: true
          };
        }
        
        console.log(`[CostPerItemService] Found ${variants.length} variants for product ${productId}`);
        
        // Process each variant
        const variantUpdates = await Promise.all(
          variants.map(async (variant: any) => {
            try {
              if (!variant.inventoryItem?.id) {
                console.log(`[CostPerItemService] Variant ${variant.id} has no inventory item, skipping`);
                return {
                  variantId: variant.id,
                  success: false,
                  error: 'No inventory item found'
                };
              }
              
              const inventoryItemId = variant.inventoryItem.id;
              const currentCost = variant.inventoryItem?.unitCost?.amount;
              const currentCurrency = variant.inventoryItem?.unitCost?.currencyCode || 'USD';
              
              console.log(`[CostPerItemService] Processing variant ${variant.id}, current cost: ${currentCost}, new cost: ${costValue}`);
              
              try {
                // Update inventory item cost using GraphQL
                const updateResponse = await admin.graphql(
                  `#graphql
                  mutation inventoryItemUpdate($input: InventoryItemUpdateInput!) {
                    inventoryItemUpdate(input: $input) {
                      inventoryItem {
                        id
                        unitCost {
                          amount
                          currencyCode
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
                        id: inventoryItemId,
                        unitCost: {
                          amount: parseFloat(costValue),
                          currencyCode: currentCurrency
                        }
                      }
                    }
                  }
                );
                
                const updateData = await updateResponse.json();
                console.log('[CostPerItemService] Update response:', updateData);
                
                if (updateData.errors) {
                  console.error('[CostPerItemService] GraphQL errors during update:', updateData.errors);
                  throw new Error(updateData.errors[0]?.message || 'GraphQL update failed');
                }
                
                if (updateData.data?.inventoryItemUpdate?.userErrors?.length > 0) {
                  console.error('[CostPerItemService] User errors during update:', updateData.data.inventoryItemUpdate.userErrors);
                  throw new Error(updateData.data.inventoryItemUpdate.userErrors[0].message);
                }
                
                const newCost = updateData.data?.inventoryItemUpdate?.inventoryItem?.unitCost?.amount;
                
                return {
                  variantId: variant.id,
                  variantTitle: variant.title,
                  success: true,
                  originalCost: currentCost,
                  newCost: newCost
                };
              } catch (graphqlError) {
                console.error(`[CostPerItemService] GraphQL update failed for variant ${variant.id}, trying REST fallback:`, graphqlError);
                
                // Try REST API as fallback
                const fallbackResult = await fallbackUpdateVariantCost(variant.id, costValue);
                
                if (fallbackResult.success) {
                  return {
                    variantId: variant.id,
                    variantTitle: variant.title,
                    success: true,
                    originalCost: currentCost,
                    newCost: fallbackResult.newCost,
                    usedFallback: true
                  };
                } else {
                  throw new Error(fallbackResult.error || 'Both GraphQL and REST API updates failed');
                }
              }
            } catch (error) {
              console.error(`[CostPerItemService] Error updating variant ${variant.id}:`, error);
              return {
                variantId: variant.id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })
        );
        
        // Check results
        const successfulUpdates = variantUpdates.filter(update => update.success);
        const failedUpdates = variantUpdates.filter(update => !update.success);
        
        console.log(`[CostPerItemService] Product ${productId} update complete. Success: ${successfulUpdates.length}, Failed: ${failedUpdates.length}`);
        
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
    
    const successfulVariants = allVariantUpdates.filter(update => update.success);
    const failedVariants = allVariantUpdates.filter(update => !update.success);
    
    console.log(`[CostPerItemService] All products processed. Success: ${successfulProducts.length}, Failed: ${failedProducts.length}, Skipped: ${skippedProducts.length}`);
    console.log(`[CostPerItemService] All variants processed. Success: ${successfulVariants.length}, Failed: ${failedVariants.length}`);
    
    if (successfulVariants.length === 0) {
      // If all updates failed, return a more informative error
      const errors = failedVariants
        .map(v => v.error)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join("; ");
      
      return json({
        success: false,
        error: `Failed to update any costs. Errors: ${errors}`,
        products: {
          total: productIds.length,
          successful: 0,
          failed: failedProducts.length,
          skipped: skippedProducts.length
        },
        variants: {
          total: allVariantUpdates.length,
          successful: 0,
          failed: failedVariants.length
        },
        results: results,
        partialFailure: true
      });
    }
    
    return json({
      success: successfulProducts.length > 0,
      products: {
        total: productIds.length,
        successful: successfulProducts.length,
        failed: failedProducts.length,
        skipped: skippedProducts.length
      },
      variants: {
        total: allVariantUpdates.length,
        successful: successfulVariants.length,
        failed: failedVariants.length
      },
      results: results,
      message: `Successfully updated cost for ${successfulVariants.length} variants across ${successfulProducts.length} products.`,
      partialFailure: failedVariants.length > 0 || failedProducts.length > 0
    });
  } catch (error) {
    console.error('[CostPerItemService] Error processing request:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 