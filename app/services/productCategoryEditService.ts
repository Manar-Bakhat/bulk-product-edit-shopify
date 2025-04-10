/**
 * Product Category Edit Service
 * Handles bulk editing of product categories
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import fs from 'fs';
import path from 'path';

/**
 * Lit le contenu du fichier taxonomyCategory.txt
 */
function readTaxonomyCategoryFile(): string {
  try {
    // Accéder directement au fichier s'il est installé avec l'application
    const filePath = path.resolve(process.cwd(), 'app/components/taxonomyCategory.txt');
    if (fs.existsSync(filePath)) {
      console.log('[ProductCategoryEditService] Reading taxonomy file from:', filePath);
      return fs.readFileSync(filePath, 'utf8');
    }
    
    // Essayer avec l'ancien nom de fichier si le nouveau n'existe pas
    const legacyFilePath = path.resolve(process.cwd(), 'app/components/taxonamyCategory.txt');
    if (fs.existsSync(legacyFilePath)) {
      console.log('[ProductCategoryEditService] Reading taxonomy file from legacy path:', legacyFilePath);
      return fs.readFileSync(legacyFilePath, 'utf8');
    }
    
    // Si le fichier n'existe pas, retourner une chaîne vide
    console.error('[ProductCategoryEditService] Taxonomy file not found at any path');
    return "";
  } catch (error) {
    console.error('[ProductCategoryEditService] Error reading taxonomy file:', error);
    return "";
  }
}

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
  const taxonomyNodeId = formData.get("newProductCategory") as string;
  
  // Obtenez le nom de la taxonomie à partir du identifiant GID
  // Pour les besoins de la collection, nous utilisons le nom de la taxonomie en tant que titre
  let taxonomyName = "Product Category"; // Valeur par défaut

  try {
    // Lire le fichier local pour trouver le nom correspondant à l'ID
    const taxonomyText = readTaxonomyCategoryFile();
    if (taxonomyText) {
      const taxonomyLines = taxonomyText.split('\n');
      const taxonomyLine = taxonomyLines.find(line => line.includes(taxonomyNodeId));
      
      if (taxonomyLine) {
        // Format: gid://shopify/TaxonomyCategory/ap-2-1-1-2-1 : Animals & Pet Supplies > ... > Bird Cage Food Dishes
        const parts = taxonomyLine.split(' : ');
        if (parts.length >= 2) {
          // Extraire le dernier segment (nom de la catégorie)
          const fullPath = parts[1].trim();
          const segments = fullPath.split(' > ');
          taxonomyName = segments[segments.length - 1];
          console.log(`[ProductCategoryEditService] Found category name: ${taxonomyName}`);
        }
      }
    }
  } catch (error) {
    console.error('[ProductCategoryEditService] Error fetching taxonomy name:', error);
    // Continuer avec l'ID comme fallback
  }

  console.log('[ProductCategoryEditService] Parsed data:', {
    productIds,
    taxonomyNodeId,
    taxonomyName
  });

  try {
    // Process each product
    console.log('[ProductCategoryEditService] Starting to process products');
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[ProductCategoryEditService] Processing product ${productId}`);
        
        // 1. Mettre à jour la taxonomie du produit
        console.log(`[ProductCategoryEditService] Setting product taxonomy for ${productId} to ${taxonomyNodeId}`);
        
        const updateTaxonomyResponse = await admin.graphql(
          `#graphql
          mutation productUpdateWithTaxonomy($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                productCategory {
                  productTaxonomyNode {
                    id
                    name
                  }
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
                id: `gid://shopify/Product/${productId}`,
                productCategory: {
                  productTaxonomyNodeId: taxonomyNodeId
                }
              }
            }
          }
        );
        
        const taxonomyResult = await updateTaxonomyResponse.json();
        console.log(`[ProductCategoryEditService] Product taxonomy update response:`, taxonomyResult);
        
        // Vérifier les erreurs de mise à jour de taxonomie
        if (taxonomyResult.data?.productUpdate?.userErrors?.length > 0) {
          console.error(`[ProductCategoryEditService] Taxonomy update errors for product ${productId}:`, taxonomyResult.data.productUpdate.userErrors);
          return {
            productId,
            success: false,
            userErrors: taxonomyResult.data.productUpdate.userErrors
          };
        }
        
        // 2. Ajouter le produit à une collection portant le même nom que la taxonomie (pour rétrocompatibilité)
        console.log(`[ProductCategoryEditService] Adding product ${productId} to collection with taxonomy name ${taxonomyName}`);
        
        // Créer une collection si elle n'existe pas
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
                title: taxonomyName,
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
        
        // Si la collection existe déjà
        if (collectionData.data?.collectionCreate?.userErrors?.length > 0) {
          // Rechercher la collection existante
          const findCollectionResponse = await admin.graphql(
            `#graphql
            query {
              collections(first: 1, query: "title:'${taxonomyName}'") {
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
            console.warn(`[ProductCategoryEditService] Could not find collection for ${taxonomyName}, but taxonomy was updated`);
            // On ne considère pas cela comme une erreur car la taxonomie a été mise à jour
            return {
              productId,
              success: true,
              userErrors: []
            };
          }
        } else {
          collectionId = collectionData.data.collectionCreate.collection.id;
          console.log(`[ProductCategoryEditService] Created new collection: ${collectionId}`);
        }
        
        // Ajouter le produit à la collection
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

        // Même si l'ajout à la collection échoue, nous considérons l'opération réussie si la taxonomie a été mise à jour
        const collectionErrors = addToCollectionData.data?.collectionAddProducts?.userErrors || [];
        if (collectionErrors.length > 0) {
          console.warn(`[ProductCategoryEditService] Collection errors for product ${productId}, but taxonomy was updated:`, collectionErrors);
        }

        return {
          productId,
          success: true,
          taxonomyId: taxonomyNodeId,
          taxonomyName,
          collection: collectionId ? {
            id: collectionId,
            title: taxonomyName
          } : null,
          userErrors: []
        };
      })
    );

    // Vérifier les erreurs
    const errors = results.flatMap(result => result.userErrors);
    if (errors.length > 0) {
      console.error('[ProductCategoryEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some products: ${errors.map(e => e.message).join(', ')}`,
        success: false
      });
    }

    // Compteur de produits mis à jour
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    
    console.log(`[ProductCategoryEditService] Product category update completed: ${successCount} updated, ${failedCount} failed`);
    return json({
      success: true,
      message: `Products successfully updated with taxonomy "${taxonomyName}" (ID: ${taxonomyNodeId})! ${successCount} products updated.`,
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