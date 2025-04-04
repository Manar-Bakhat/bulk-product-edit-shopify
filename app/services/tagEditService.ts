/**
 * Tag Edit Service
 * Handles bulk editing of product tags
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Fetches unique tags from a list of products
 * @param request - The incoming request
 * @param formData - The form data containing product IDs
 * @returns JSON response with all unique tags
 */
export async function fetchProductTags(request: Request, formData: FormData) {
  console.log('[TagEditService] Fetching tags for selected products');
  
  const { admin } = await authenticate.admin(request);
  
  try {
    const productIds = JSON.parse(formData.get("productIds") as string);
    
    if (!productIds || !productIds.length) {
      return json({ error: 'No products selected' });
    }
    
    console.log(`[TagEditService] Fetching tags for ${productIds.length} products`);
    
    // Fetch tags for each product
    const tagPromises = productIds.map(async (productId: string) => {
      const response = await admin.graphql(
        `#graphql
        query getProductTags($id: ID!) {
          product(id: $id) {
            id
            tags
          }
        }`,
        {
          variables: {
            id: `gid://shopify/Product/${productId}`
          }
        }
      );
      
      const data = await response.json();
      return data.data.product.tags || [];
    });
    
    const allTagsArrays = await Promise.all(tagPromises);
    
    // Flatten array and get unique tags
    const uniqueTags = [...new Set(allTagsArrays.flat())].sort();
    
    console.log(`[TagEditService] Found ${uniqueTags.length} unique tags`);
    
    return json({ tags: uniqueTags });
  } catch (error) {
    console.error('[TagEditService] Error fetching tags:', error);
    return json({ 
      error: 'Failed to fetch tags',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handles bulk tag editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleTagEdit(request: Request, formData: FormData) {
  console.log('[TagEditService] Starting tag edit process');
  
  const { admin } = await authenticate.admin(request);
  console.log('[TagEditService] Admin authenticated');

  // Check if this is a request to fetch tags
  const action = formData.get("action");
  if (action === "fetchTags") {
    return fetchProductTags(request, formData);
  }

  // Log all form data for debugging
  console.log('[TagEditService] Form data received:', {
    productIds: formData.get("productIds"),
    tagAction: formData.get("tagAction"),
    tags: formData.get("tags"),
    tagsToRemove: formData.get("tagsToRemove"),
    findTags: formData.get("findTags"),
    replaceTags: formData.get("replaceTags")
  });

  const productIds = JSON.parse(formData.get("productIds") as string);
  const tagAction = formData.get("tagAction") as string;
  const tags = formData.get("tags") as string;
  const tagsToRemoveJSON = formData.get("tagsToRemove") as string;
  const tagsToRemove = tagsToRemoveJSON ? JSON.parse(tagsToRemoveJSON) : [];
  const findTags = formData.get("findTags") as string;
  const replaceTags = formData.get("replaceTags") as string;

  console.log('[TagEditService] Parsed data:', {
    productIds,
    tagAction,
    tags,
    tagsToRemove,
    findTags,
    replaceTags
  });

  try {
    // Process each product
    console.log('[TagEditService] Starting to process products');
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[TagEditService] Processing product ${productId}`);
        
        // First get the current product tags
        console.log(`[TagEditService] Fetching current tags for product ${productId}`);
        const getProductResponse = await admin.graphql(
          `#graphql
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              tags
            }
          }`,
          {
            variables: {
              id: `gid://shopify/Product/${productId}`
            }
          }
        );

        const productData = await getProductResponse.json();
        console.log(`[TagEditService] Current tags for product ${productId}:`, productData.data.product.tags);
        
        // Current tags array
        const currentTags = productData.data.product.tags;
        
        // Calculate new tags based on action
        let newTags: string[] = [];
        
        switch(tagAction) {
          case 'add_tags':
            // Add new tags to existing tags
            const tagsToAdd = tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            newTags = [...new Set([...currentTags, ...tagsToAdd])]; // Use Set to remove duplicates
            console.log(`[TagEditService] Adding tags: ${tagsToAdd.join(', ')}`);
            break;
            
          case 'remove':
            // Remove specific tags from input field
            const tagsToRemove = tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            if (tagsToRemove.length) {
              // Remove only specified tags
              newTags = currentTags.filter((tag: string) => !tagsToRemove.includes(tag));
              console.log(`[TagEditService] Removing specific tags: ${tagsToRemove.join(', ')}`);
            } else {
              // Remove all tags if none specifically entered
              newTags = [];
              console.log(`[TagEditService] Removing all tags`);
            }
            break;
            
          case 'replace':
            // Replace all tags with new tags
            newTags = tags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            console.log(`[TagEditService] Replacing all tags with: ${newTags.join(', ')}`);
            break;
            
          case 'find_replace':
            // Find specific tags and replace them
            const tagsToFind = findTags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            const tagsToReplace = replaceTags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            
            // Start with all current tags except those we want to find/replace
            newTags = currentTags.filter((tag: string) => !tagsToFind.includes(tag));
            
            // Add the replacement tags
            newTags = [...newTags, ...tagsToReplace];
            
            console.log(`[TagEditService] Finding tags: ${tagsToFind.join(', ')} and replacing with: ${tagsToReplace.join(', ')}`);
            break;
            
          default:
            newTags = currentTags;
            console.log(`[TagEditService] Unknown action, keeping current tags`);
        }
        
        console.log(`[TagEditService] New tags for product ${productId}:`, newTags);

        // Update the product
        console.log(`[TagEditService] Sending GraphQL mutation for product ${productId}`);
        const response = await admin.graphql(
          `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                tags
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
                tags: newTags
              }
            }
          }
        );

        const responseJson = await response.json();
        console.log(`[TagEditService] GraphQL response for product ${productId}:`, responseJson);

        if (responseJson.data?.productUpdate?.userErrors?.length > 0) {
          console.error(`[TagEditService] Errors for product ${productId}:`, responseJson.data.productUpdate.userErrors);
        }

        return {
          ...responseJson.data.productUpdate,
          productId,
          originalTags: currentTags,
          newTags: responseJson.data.productUpdate.product.tags
        };
      })
    );

    // Check for any errors
    const errors = results.flatMap(result => result.userErrors);
    if (errors.length > 0) {
      console.error('[TagEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some products: ${errors.map(e => e.message).join(', ')}`,
        success: false
      });
    }

    // Prepare success statistics
    const successCount = results.length;
    
    console.log(`[TagEditService] All ${successCount} products updated successfully`);
    return json({
      success: true,
      message: `Tags updated successfully for ${successCount} products!`,
      results: results.map(result => ({
        productId: result.productId,
        originalTags: result.originalTags,
        newTags: result.newTags
      }))
    });
  } catch (error) {
    console.error('[TagEditService] Error updating tags:', error);
    return json({
      error: 'Failed to update tags',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 