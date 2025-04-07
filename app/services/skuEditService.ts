/**
 * SKU Edit Service
 * Handles bulk editing of product SKUs
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk SKU editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleSkuEdit(request: Request, formData: FormData) {
  console.log('[SkuEditService] Starting SKU edit process');
  
  const { admin, session } = await authenticate.admin(request);
  console.log('[SkuEditService] Admin authenticated');

  // Méthode de contournement si la mutation GraphQL échoue
  async function fallbackUpdateSku(variantId: string, newSku: string) {
    try {
      // Extraction de l'ID numérique de la variante depuis l'ID gid
      const numericId = variantId.split('/').pop();
      if (!numericId) {
        throw new Error(`Impossible d'extraire l'ID numérique de ${variantId}`);
      }
      
      console.log(`[SkuEditService] Tentative de solution alternative avec REST API pour variant ${numericId}`);
      
      // Utiliser l'API REST comme solution de secours (avec fetch directement)
      const shop = session.shop;
      const token = session.accessToken;
      
      if (!token) {
        throw new Error("Token d'accès Shopify non disponible");
      }
      
      const response = await fetch(
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
              sku: newSku
            }
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Échec de la requête REST: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      console.log(`[SkuEditService] Réponse de l'API REST:`, data);
      
      return {
        success: true,
        sku: data.variant?.sku || newSku
      };
    } catch (error) {
      console.error(`[SkuEditService] La solution alternative a également échoué:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  // Vérification de l'API Shopify disponible
  try {
    // Exécuter une requête pour récupérer la version de l'API
    const apiVersionResponse = await admin.graphql(
      `#graphql
      query {
        shop {
          name
        }
      }`
    );
    const apiData = await apiVersionResponse.json();
    console.log('[SkuEditService] API Shopify connectée, boutique:', apiData.data?.shop?.name);
  } catch (error) {
    console.error('[SkuEditService] Erreur lors de la vérification de l\'API Shopify:', error);
  }

  // Log all form data for debugging
  console.log('[SkuEditService] Form data received:', {
    productIds: formData.get("productIds"),
    skuAction: formData.get("skuAction"),
    skuValue: formData.get("skuValue"),
    findText: formData.get("findText"),
    replaceText: formData.get("replaceText"),
    prefix: formData.get("prefix"),
    suffix: formData.get("suffix")
  });

  try {
    // Validation des paramètres
    if (!formData.get("productIds")) {
      throw new Error("Missing required parameter: productIds");
    }

  const productIds = JSON.parse(formData.get("productIds") as string);
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error("Invalid or empty productIds array");
    }
    
  const skuAction = formData.get("skuAction") as string;
    if (!skuAction) {
      throw new Error("Missing required parameter: skuAction");
    }
    
    // Validation des paramètres spécifiques selon l'action
    let skuValue = "";
    let findText = "";
    let replaceText = "";
    let prefix = "";
    let suffix = "";
    
    switch(skuAction) {
      case 'update':
      case 'replace':
        skuValue = formData.get("skuValue") as string;
        if (!skuValue) {
          throw new Error(`Missing required parameter skuValue for action: ${skuAction}`);
        }
        break;
      
      case 'find_replace':
        findText = formData.get("findText") as string;
        replaceText = formData.get("replaceText") as string;
        if (!findText) {
          throw new Error("Missing required parameter: findText");
        }
        break;
        
      case 'add_prefix':
        prefix = formData.get("prefix") as string;
        if (!prefix) {
          throw new Error("Missing required parameter: prefix");
        }
        break;
        
      case 'add_suffix':
        suffix = formData.get("suffix") as string;
        if (!suffix) {
          throw new Error("Missing required parameter: suffix");
        }
        break;
        
      default:
        throw new Error(`Unsupported SKU action: ${skuAction}`);
    }

    console.log('[SkuEditService] Validated data:', {
    productIds,
    skuAction,
    skuValue,
    findText,
    replaceText,
    prefix,
    suffix
  });

    // Process each product
    console.log('[SkuEditService] Starting to process products');
    console.log(`[SkuEditService] Using action type: "${skuAction}" with value: "${skuValue}"`);
    
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[SkuEditService] Processing product ${productId}`);
        
        // First get the current product variants to get SKUs
        console.log(`[SkuEditService] Fetching variants for product ${productId}`);
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
                    sku
                    title
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
        const variants = productData.data.product.variants.edges.map((edge: any) => edge.node);
        console.log(`[SkuEditService] Found ${variants.length} variants for product ${productId}`);
        
        // Skip product if it has no variants
        if (variants.length === 0) {
          console.log(`[SkuEditService] Product ${productId} has no variants, skipping`);
          return {
            productId,
            success: false,
            userErrors: [{ message: 'No variants found' }],
            skipped: true
          };
        }

        // Process each variant to update its SKU
        const variantUpdates = await Promise.all(
          variants.map(async (variant: any) => {
            const originalSku = variant.sku || '';
            let newSku = originalSku;
            
            // Calculate new SKU based on action
            switch(skuAction) {
              case 'replace':
              case 'update':
                // Replace entire SKU with new value
                console.log(`[SkuEditService] Updating SKU for variant ${variant.id} using ${skuAction} action`);
                console.log(`[SkuEditService] Will change SKU from "${originalSku}" to "${skuValue}"`);
                newSku = skuValue;
                break;
                
              case 'find_replace':
                // Replace text within SKU
                if (originalSku.includes(findText)) {
                  newSku = originalSku.replace(new RegExp(findText, 'g'), replaceText);
                }
                break;
                
              case 'add_prefix':
                // Add prefix to SKU
                newSku = prefix + originalSku;
                break;
                
              case 'add_suffix':
                // Add suffix to SKU
                newSku = originalSku + suffix;
                break;
                
              default:
                // No change
                console.log(`[SkuEditService] Unknown action for variant ${variant.id}, keeping current SKU`);
            }
            
            // Skip update if SKU is already the same
            if (originalSku === newSku) {
              console.log(`[SkuEditService] Variant ${variant.id} already has SKU ${newSku}, skipping update`);
              return {
                variantId: variant.id,
                originalSku,
                newSku,
                userErrors: [],
                skipped: true
              };
            }
            
            // Vérifier que l'ID du variant est au bon format
            if (!variant.id.startsWith('gid://')) {
              console.error(`[SkuEditService] Variant ID ${variant.id} n'est pas au format attendu (gid://). Impossible de mettre à jour.`);
              return {
                variantId: variant.id,
                originalSku,
                newSku: originalSku,
                userErrors: [{ message: `Invalid variant ID format: ${variant.id}` }],
                skipped: true
              };
            }
            
            // Utiliser directement l'API REST pour la mise à jour
            console.log(`[SkuEditService] Updating SKU from ${originalSku} to ${newSku} for variant ${variant.id}`);
            try {
              // Utiliser la méthode REST, qui fonctionne de manière fiable
              const result = await fallbackUpdateSku(variant.id, newSku);
              
              if (result.success) {
                console.log(`[SkuEditService] SKU successfully updated for variant ${variant.id}`);
                return {
                  variantId: variant.id,
                  originalSku,
                  newSku: result.sku,
                  userErrors: [],
                  skipped: false
                };
              } else {
                console.error(`[SkuEditService] Failed to update SKU for variant ${variant.id}:`, result.error);
                return {
                  variantId: variant.id,
                  originalSku,
                  newSku: originalSku,
                  userErrors: [{ message: `Failed to update SKU: ${result.error}` }],
                  skipped: true
                };
              }
            } catch (error) {
              console.error(`[SkuEditService] Error updating variant ${variant.id}:`, error);
            return {
              variantId: variant.id,
              originalSku,
                newSku: originalSku,
                userErrors: [{ message: error instanceof Error ? error.message : 'Unknown error during update' }],
                skipped: true
              };
            }
          })
        );

        // Check if any variants were updated successfully
        const updatedVariants = variantUpdates.filter(update => !update.skipped);
        const hasSuccessfulUpdates = updatedVariants.length > 0;
        
        return {
          productId,
          productTitle: productData.data.product.title,
          success: hasSuccessfulUpdates,
          variantUpdates,
          skipped: false
        };
      })
    );

    // Count updated products and variants
    const processedProducts = results.filter(r => !r.skipped).length;
    const totalVariantsUpdated = results
      .flatMap(r => r.variantUpdates || [])
      .filter(v => !v.skipped)
      .length;
    
    // Check for any errors
    const errors = results
      .flatMap(result => result.variantUpdates || [])
      .flatMap(varUpdate => varUpdate.userErrors || []);
      
    if (errors.length > 0) {
      console.error('[SkuEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some variants: ${errors.map(e => e.message).join(', ')}`,
        success: true,
        partialFailure: true,
        message: `Updated ${totalVariantsUpdated} variants across ${processedProducts} products with some errors.`
      });
    }

    console.log(`[SkuEditService] SKU update completed: ${totalVariantsUpdated} variants updated across ${processedProducts} products`);
    return json({
      success: true,
      message: `SKUs updated successfully! Updated ${totalVariantsUpdated} variants across ${processedProducts} products.`,
      results: results.map(result => ({
        productId: result.productId,
        productTitle: result.productTitle,
        variantUpdates: (result.variantUpdates || []).map((v: any) => ({
          variantId: v.variantId,
          originalSku: v.originalSku,
          newSku: v.newSku,
          skipped: v.skipped
        }))
      }))
    });
  } catch (error) {
    console.error('[SkuEditService] Error updating SKUs:', error);
    return json({
      error: 'Failed to update product SKUs',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}