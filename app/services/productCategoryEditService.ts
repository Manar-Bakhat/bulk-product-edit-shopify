/**
 * Product Category Edit Service
 * Handles bulk editing of product categories
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk product category editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleProductCategoryEdit(request: Request, formData: FormData) {
  console.log('[ProductCategoryEditService] Starting product category edit process');
  
  const { admin } = await authenticate.admin(request);
  console.log('[ProductCategoryEditService] Admin authenticated');

  // Log all form data for debugging
  console.log('[ProductCategoryEditService] Form data received:', {
    productIds: formData.get("productIds"),
    newProductCategory: formData.get("newProductCategory")
  });

  const productIds = JSON.parse(formData.get("productIds") as string);
  const newProductCategory = formData.get("newProductCategory") as string;

  console.log('[ProductCategoryEditService] Parsed data:', {
    productIds,
    newProductCategory
  });

  try {
    // Process each product
    console.log('[ProductCategoryEditService] Starting to process products');
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[ProductCategoryEditService] Processing product ${productId}`);
        
        // First add the category to the product collections
        console.log(`[ProductCategoryEditService] Adding product ${productId} to category ${newProductCategory}`);
        
        // Create a collection if it doesn't exist
        const collectionResponse = await admin.graphql(
          `#graphql
          mutation collectionCreate($input: CollectionInput!) {
            collectionCreate(input: $input) {
              collection {
                id
                title
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
                title: newProductCategory,
                ruleSet: {
                  rules: [
                    {
                      column: "TITLE",
                      relation: "EQUALS",
                      condition: "placeholder_condition_that_wont_match"
                    }
                  ]
                }
              }
            }
          }
        );

        const collectionData = await collectionResponse.json();
        
        let collectionId;
        
        // If there were errors creating the collection, it might be because it already exists
        if (collectionData.data?.collectionCreate?.userErrors?.length > 0) {
          // Search for the existing collection
          const findCollectionResponse = await admin.graphql(
            `#graphql
            query {
              collections(first: 1, query: "title:'${newProductCategory}'") {
                edges {
                  node {
                    id
                    title
                  }
                }
              }
            }`
          );
          
          const findCollectionData = await findCollectionResponse.json();
          
          if (findCollectionData.data?.collections?.edges?.length > 0) {
            collectionId = findCollectionData.data.collections.edges[0].node.id;
            console.log(`[ProductCategoryEditService] Found existing collection: ${collectionId}`);
          } else {
            return {
              productId,
              success: false,
              userErrors: [{
                field: "collection",
                message: "Failed to create or find category collection"
              }]
            };
          }
        } else {
          collectionId = collectionData.data.collectionCreate.collection.id;
          console.log(`[ProductCategoryEditService] Created new collection: ${collectionId}`);
        }
        
        // Add product to collection
        const addToCollectionResponse = await admin.graphql(
          `#graphql
          mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
            collectionAddProducts(id: $id, productIds: $productIds) {
              collection {
                id
                title
                productsCount
              }
              userErrors {
                field
                message
              }
            }
          }`,
          {
            variables: {
              id: collectionId,
              productIds: [`gid://shopify/Product/${productId}`]
            }
          }
        );

        const addToCollectionData = await addToCollectionResponse.json();
        console.log(`[ProductCategoryEditService] Add to collection response for product ${productId}:`, addToCollectionData);

        if (addToCollectionData.data?.collectionAddProducts?.userErrors?.length > 0) {
          console.error(`[ProductCategoryEditService] Errors for product ${productId}:`, addToCollectionData.data.collectionAddProducts.userErrors);
          return {
            productId,
            success: false,
            userErrors: addToCollectionData.data.collectionAddProducts.userErrors
          };
        }

        return {
          productId,
          success: true,
          collection: {
            id: collectionId,
            title: newProductCategory
          },
          userErrors: []
        };
      })
    );

    // Check for any errors
    const errors = results.flatMap(result => result.userErrors);
    if (errors.length > 0) {
      console.error('[ProductCategoryEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some products: ${errors.map(e => e.message).join(', ')}`,
        success: false
      });
    }

    // Count updated products
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[ProductCategoryEditService] Product category update completed: ${successCount} updated, ${failedCount} failed`);
    return json({
      success: true,
      message: `Products successfully added to category "${newProductCategory}"! ${successCount} products updated.`,
      results: results.map(result => ({
        productId: result.productId,
        success: result.success
      }))
    });
  } catch (error) {
    console.error('[ProductCategoryEditService] Error updating product category:', error);
    return json({
      error: 'Failed to update product category',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 