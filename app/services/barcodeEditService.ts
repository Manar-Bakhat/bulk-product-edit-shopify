/**
 * Barcode Edit Service
 * Handles bulk editing of product barcodes
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk barcode editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleBarcodeEdit(request: Request, formData: FormData) {
  console.log('[BarcodeEditService] Starting barcode edit process');
  
  const { admin, session } = await authenticate.admin(request);
  console.log('[BarcodeEditService] Admin authenticated');

  // Méthode de contournement si la mutation GraphQL échoue
  async function fallbackUpdateBarcode(variantId: string, newBarcode: string) {
    try {
      // Extraction de l'ID numérique de la variante depuis l'ID gid
      const numericId = variantId.split('/').pop();
      if (!numericId) {
        throw new Error(`Impossible d'extraire l'ID numérique de ${variantId}`);
      }
      
      console.log(`[BarcodeEditService] Tentative de solution alternative avec REST API pour variant ${numericId}`);
      
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
              barcode: newBarcode
            }
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Échec de la requête REST: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      console.log(`[BarcodeEditService] Réponse de l'API REST:`, data);
      
      return {
        success: true,
        barcode: data.variant?.barcode || newBarcode
      };
    } catch (error) {
      console.error(`[BarcodeEditService] La solution alternative a également échoué:`, error);
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
    console.log('[BarcodeEditService] API Shopify connectée, boutique:', apiData.data?.shop?.name);
  } catch (error) {
    console.error('[BarcodeEditService] Erreur lors de la vérification de l\'API Shopify:', error);
  }

  // Log all form data for debugging
  console.log('[BarcodeEditService] Form data received:', {
    productIds: formData.get("productIds"),
    barcodeValue: formData.get("barcodeValue")
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
    
    const barcodeValue = formData.get("barcodeValue") as string;
    if (!barcodeValue) {
      throw new Error("Missing required parameter: barcodeValue");
    }

    console.log('[BarcodeEditService] Validated data:', {
      productIds,
      barcodeValue
    });

    // Process each product
    console.log('[BarcodeEditService] Starting to process products');
    console.log(`[BarcodeEditService] Using barcode value: "${barcodeValue}"`);
    
    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[BarcodeEditService] Processing product ${productId}`);
        
        // First get the current product variants to get barcodes
        console.log(`[BarcodeEditService] Fetching variants for product ${productId}`);
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
                    barcode
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
        console.log(`[BarcodeEditService] Found ${variants.length} variants for product ${productId}`);
        
        // Skip product if it has no variants
        if (variants.length === 0) {
          console.log(`[BarcodeEditService] Product ${productId} has no variants, skipping`);
          return {
            productId,
            success: false,
            userErrors: [{ message: 'No variants found' }],
            skipped: true
          };
        }

        // Process each variant to update its barcode
        const variantUpdates = await Promise.all(
          variants.map(async (variant: any) => {
            const originalBarcode = variant.barcode || '';
            let newBarcode = barcodeValue;
            
            // Skip update if barcode is already the same
            if (originalBarcode === newBarcode) {
              console.log(`[BarcodeEditService] Variant ${variant.id} already has barcode ${newBarcode}, skipping update`);
              return {
                variantId: variant.id,
                originalBarcode,
                newBarcode,
                userErrors: [],
                skipped: true
              };
            }
            
            // Vérifier que l'ID du variant est au bon format
            if (!variant.id.startsWith('gid://')) {
              console.error(`[BarcodeEditService] Variant ID ${variant.id} n'est pas au format attendu (gid://). Impossible de mettre à jour.`);
              return {
                variantId: variant.id,
                originalBarcode,
                newBarcode: originalBarcode,
                userErrors: [{ message: `Invalid variant ID format: ${variant.id}` }],
                skipped: true
              };
            }
            
            // Utiliser directement l'API REST pour la mise à jour
            console.log(`[BarcodeEditService] Updating barcode from ${originalBarcode} to ${newBarcode} for variant ${variant.id}`);
            try {
              // Utiliser la méthode REST, qui fonctionne de manière fiable
              const result = await fallbackUpdateBarcode(variant.id, newBarcode);
              
              if (result.success) {
                console.log(`[BarcodeEditService] Barcode successfully updated for variant ${variant.id}`);
                return {
                  variantId: variant.id,
                  originalBarcode,
                  newBarcode: result.barcode,
                  userErrors: [],
                  skipped: false
                };
              } else {
                console.error(`[BarcodeEditService] Failed to update barcode for variant ${variant.id}:`, result.error);
                return {
                  variantId: variant.id,
                  originalBarcode,
                  newBarcode: originalBarcode,
                  userErrors: [{ message: `Failed to update barcode: ${result.error}` }],
                  skipped: true
                };
              }
            } catch (error) {
              console.error(`[BarcodeEditService] Error updating variant ${variant.id}:`, error);
              return {
                variantId: variant.id,
                originalBarcode,
                newBarcode: originalBarcode,
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
      console.error('[BarcodeEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some variants: ${errors.map(e => e.message).join(', ')}`,
        success: true,
        partialFailure: true,
        message: `Updated ${totalVariantsUpdated} variants across ${processedProducts} products with some errors.`
      });
    }

    console.log(`[BarcodeEditService] Barcode update completed: ${totalVariantsUpdated} variants updated across ${processedProducts} products`);
    return json({
      success: true,
      message: `Barcodes updated successfully! Updated ${totalVariantsUpdated} variants across ${processedProducts} products.`,
      results: results.map(result => ({
        productId: result.productId,
        productTitle: result.productTitle,
        variantUpdates: (result.variantUpdates || []).map((v: any) => ({
          variantId: v.variantId,
          originalBarcode: v.originalBarcode,
          newBarcode: v.newBarcode,
          skipped: v.skipped
        }))
      }))
    });
  } catch (error) {
    console.error('[BarcodeEditService] Error updating barcodes:', error);
    return json({
      error: 'Failed to update product barcodes',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 