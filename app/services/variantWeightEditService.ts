/**
 * Variant Weight Edit Service
 * Handles bulk editing of product variant weight units and values
 * 
 * @author Manar Bakhat
 */

import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Handles bulk variant weight editing
 * @param request - The incoming request
 * @param formData - The form data containing edit parameters
 * @returns JSON response with success/error status
 */
export async function handleVariantWeightEdit(request: Request, formData: FormData) {
  console.log('[VariantWeightEditService] Starting variant weight edit process');
  
  const { admin, session } = await authenticate.admin(request);
  console.log('[VariantWeightEditService] Admin authenticated');

  // Si c'est une requête de prévisualisation (preview), traiter différemment
  if (!formData.get("actionType")) {
    console.log('[VariantWeightEditService] Handling preview request');
    
    try {
      // Récupérer les paramètres de filtre
      const field = formData.get("field") as string;
      const condition = formData.get("condition") as string;
      const value = formData.get("value") as string;
      
      console.log('[VariantWeightEditService] Filter params:', { field, condition, value });
      
      // Requête GraphQL pour obtenir les produits filtrés
      let query = '';
      if (field === 'productId' && condition === 'is') {
        query = `
          query {
            product(id: "gid://shopify/Product/${value}") {
              id
              title
              description
              productType
              vendor
              status
              featuredImage {
                url
                altText
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    weight
                    weightUnit
                  }
                }
              }
            }
          }
        `;
      } else {
        // Construire la requête GraphQL pour les autres filtres
        let queryCondition = '';
        const escapedValue = value.replace(/['"]/g, '').trim();
        
        switch (condition) {
          case 'is':
            queryCondition = `${field}:'${escapedValue}'`;
            break;
          case 'contains':
            queryCondition = `${field}:'*${escapedValue}*'`;
            break;
          case 'doesNotContain':
            queryCondition = `NOT ${field}:'*${escapedValue}*'`;
            break;
          case 'startsWith':
            queryCondition = `${field}:'${escapedValue}*'`;
            break;
          case 'endsWith':
            queryCondition = `${field}:'*${escapedValue}'`;
            break;
          case 'empty':
            queryCondition = `NOT ${field}:*`;
            break;
        }
        
        query = `
          query {
            products(first: 50, query: "${queryCondition}") {
              edges {
                node {
                  id
                  title
                  description
                  productType
                  vendor
                  status
                  featuredImage {
                    url
                    altText
                  }
                  priceRangeV2 {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        weight
                        weightUnit
                      }
                    }
                  }
                }
              }
            }
          }
        `;
      }
      
      // Exécuter la requête GraphQL
      const response = await admin.graphql(query);
      const responseData = await response.json();
      
      console.log('[VariantWeightEditService] GraphQL response for preview');
      
      // Vérifier si les poids sont présents, sinon utiliser l'API REST
      let productsToReturn;
      
      if (field === 'productId' && responseData.data.product) {
        const product = responseData.data.product;
        const missingWeightInfo = !product.variants?.edges?.[0]?.node?.weight && !product.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight;
        
        if (missingWeightInfo && formData.get("useRestApi") === "true") {
          console.log('[VariantWeightEditService] Weight info missing, fetching via REST API');
          // Récupérer via REST API
          const shop = session.shop;
          const token = session.accessToken;
          
          if (!token) {
            throw new Error("Shopify access token not available");
          }
          
          const productId = product.id.replace('gid://shopify/Product/', '');
          
          // Récupérer les variantes du produit via REST API
          const variantsResponse = await fetch(
            `https://${shop}/admin/api/2023-10/products/${productId}/variants.json`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token
              }
            }
          );
          
          if (!variantsResponse.ok) {
            throw new Error(`Failed to fetch variants via REST: ${variantsResponse.statusText}`);
          }
          
          const variantsData = await variantsResponse.json();
          console.log(`[VariantWeightEditService] REST variants data for product ${productId}:`, JSON.stringify(variantsData, null, 2));
          
          // Mettre à jour les données des variantes avec les poids corrects
          product.variants.edges = variantsData.variants.map((variant: any) => {
            // S'assurer que les propriétés de poids sont converties correctement
            const weight = variant.weight !== null && variant.weight !== undefined 
              ? String(variant.weight) 
              : '';
            
            console.log(`[VariantWeightEditService] Variant ${variant.id} weight data:`, {
              originalWeight: variant.weight,
              processedWeight: weight,
              weightUnit: variant.weight_unit
            });
            
            return {
              node: {
                id: `gid://shopify/ProductVariant/${variant.id}`,
                title: variant.title,
                weight: weight,
                weight_unit: variant.weight_unit,
                weightUnit: variant.weight_unit
              }
            };
          });
          
          productsToReturn = { 
            data: { 
              products: { 
                edges: [{ node: product }] 
              } 
            } 
          };
        } else {
          productsToReturn = { 
            data: { 
              products: { 
                edges: [{ node: product }] 
              } 
            } 
          };
        }
      } else {
        // Pour les recherches de plusieurs produits
        const products = responseData.data.products.edges;
        const missingWeightInfo = products.length > 0 && !products[0].node.variants?.edges?.[0]?.node?.weight && !products[0].node.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight;
        
        if (missingWeightInfo && formData.get("useRestApi") === "true") {
          console.log('[VariantWeightEditService] Weight info missing in bulk results, fetching via REST API');
          // Récupérer via REST API pour chaque produit
          const shop = session.shop;
          const token = session.accessToken;
          
          if (!token) {
            throw new Error("Shopify access token not available");
          }
          
          // Promettre de récupérer les données des variantes pour tous les produits
          const productsWithVariants = await Promise.all(
            products.map(async (product: any) => {
              const productId = product.node.id.replace('gid://shopify/Product/', '');
              
              // Récupérer les variantes du produit via REST API
              const variantsResponse = await fetch(
                `https://${shop}/admin/api/2023-10/products/${productId}/variants.json`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': token
                  }
                }
              );
              
              if (!variantsResponse.ok) {
                console.error(`Failed to fetch variants for product ${productId}: ${variantsResponse.statusText}`);
                return product; // Retourner le produit sans modifications
              }
              
              const variantsData = await variantsResponse.json();
              console.log(`[VariantWeightEditService] REST variants data for product ${productId}:`, JSON.stringify(variantsData, null, 2));
              
              // Mettre à jour les données des variantes avec les poids corrects
              product.node.variants.edges = variantsData.variants.map((variant: any) => {
                // S'assurer que les propriétés de poids sont converties correctement
                const weight = variant.weight !== null && variant.weight !== undefined 
                  ? String(variant.weight) 
                  : '';
                
                console.log(`[VariantWeightEditService] Variant ${variant.id} weight data:`, {
                  originalWeight: variant.weight,
                  processedWeight: weight,
                  weightUnit: variant.weight_unit
                });
                
                return {
                  node: {
                    id: `gid://shopify/ProductVariant/${variant.id}`,
                    title: variant.title,
                    weight: weight,
                    weight_unit: variant.weight_unit,
                    weightUnit: variant.weight_unit
                  }
                };
              });
              
              return product;
            })
          );
          
          productsToReturn = { 
            data: { 
              products: { 
                edges: productsWithVariants 
              } 
            } 
          };
        } else {
          productsToReturn = responseData;
        }
      }
      
      return json(productsToReturn);
    } catch (error) {
      console.error('[VariantWeightEditService] Error in preview request:', error);
      return json({
        error: error instanceof Error ? error.message : 'Unknown error during preview',
        success: false
      });
    }
  }

  // Méthode de contournement si la mutation GraphQL échoue
  async function fallbackUpdateVariantWeight(variantId: string, weightValue: string | null, weightUnit: string) {
    try {
      // Extraction de l'ID numérique de la variante depuis l'ID gid
      const numericId = variantId.split('/').pop();
      if (!numericId) {
        throw new Error(`Impossible d'extraire l'ID numérique de ${variantId}`);
      }
      
      console.log(`[VariantWeightEditService] Tentative de solution alternative avec REST API pour variant ${numericId}`);
      
      // Si on a uniquement l'unité de poids, il faut d'abord récupérer le poids actuel
      let currentWeight = null;
      let currentWeightUnit = null;
      
      // Récupérer la variante actuelle pour obtenir son poids et son unité
      const shop = session.shop;
      const token = session.accessToken;
      
      if (!token) {
        throw new Error("Token d'accès Shopify non disponible");
      }
      
      const getResponse = await fetch(
        `https://${shop}/admin/api/2023-10/variants/${numericId}.json`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token
          }
        }
      );
      
      if (!getResponse.ok) {
        const errorData = await getResponse.json();
        throw new Error(`Échec de la requête GET REST: ${JSON.stringify(errorData)}`);
      }
      
      const variantData = await getResponse.json();
      currentWeight = variantData.variant?.weight?.toString() || '0';
      currentWeightUnit = variantData.variant?.weight_unit?.toLowerCase() || 'g';
      console.log(`[VariantWeightEditService] Récupération des valeurs actuelles: poids=${currentWeight}, unité=${currentWeightUnit}`);
      
      // Utiliser le poids fourni ou le poids actuel
      const weightToUpdate = weightValue !== null ? weightValue : currentWeight;
      
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
              weight: parseFloat(weightToUpdate || '0'),
              weight_unit: weightUnit
            }
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Échec de la requête REST: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      console.log(`[VariantWeightEditService] Réponse de l'API REST:`, data);
      
      return {
        success: true,
        weight: data.variant?.weight?.toString() || weightToUpdate,
        weight_unit: data.variant?.weight_unit || weightUnit,
        originalWeight: currentWeight,
        originalWeightUnit: currentWeightUnit
      };
    } catch (error) {
      console.error(`[VariantWeightEditService] La solution alternative a également échoué:`, error);
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
    console.log('[VariantWeightEditService] API Shopify connectée, boutique:', apiData.data?.shop?.name);
  } catch (error) {
    console.error('[VariantWeightEditService] Erreur lors de la vérification de l\'API Shopify:', error);
  }

  // Log all form data for debugging
  console.log('[VariantWeightEditService] Form data received:', {
    productIds: formData.get("productIds"),
    weightValue: formData.get("weightValue"),
    weightUnit: formData.get("weightUnit")
  });

  try {
    // Déterminer le mode d'édition
    const hasWeightValue = formData.has("weightValue") && formData.get("weightValue") !== "";
    const editMode = hasWeightValue ? 'weight' : 'weightUnit';
    console.log(`[VariantWeightEditService] Mode d'édition: ${editMode}`);

    // Validation des paramètres
    if (!formData.get("productIds")) {
      throw new Error("Missing required parameter: productIds");
    }

    const productIds = JSON.parse(formData.get("productIds") as string);
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new Error("Invalid or empty productIds array");
    }
    
    // Valider la valeur du poids si fournie
    let weightValue = null;
    if (hasWeightValue) {
      const weightValueStr = formData.get("weightValue") as string;
      if (isNaN(Number(weightValueStr)) || Number(weightValueStr) < 0) {
        throw new Error("Invalid weight value: must be a positive number");
      }
      weightValue = weightValueStr;
    }
    
    const weightUnit = formData.get("weightUnit") as string;
    if (!weightUnit || !['g', 'kg', 'oz', 'lb'].includes(weightUnit)) {
      throw new Error("Missing or invalid required parameter: weightUnit (must be one of 'g', 'kg', 'oz', 'lb')");
    }

    console.log('[VariantWeightEditService] Validated data:', {
      productIds,
      weightValue,
      weightUnit,
      editMode
    });

    // Process each product
    console.log('[VariantWeightEditService] Starting to process products');
    if (editMode === 'weight') {
      console.log(`[VariantWeightEditService] Using weight value: "${weightValue}" ${weightUnit}`);
    } else {
      console.log(`[VariantWeightEditService] Using weight unit: ${weightUnit}`);
    }

    // Vérifier si on force l'utilisation de l'API REST
    const useRestApi = formData.get("useRestApi") === "true" || false;
    if (useRestApi) {
      console.log('[VariantWeightEditService] Forcing use of REST API as requested');
    }

    const results = await Promise.all(
      productIds.map(async (productId: string) => {
        console.log(`[VariantWeightEditService] Processing product ${productId}`);
        
        // Si on force l'API REST ou si on a eu des problèmes avec GraphQL auparavant,
        // utiliser directement l'API REST pour récupérer les informations de variantes
        if (useRestApi) {
          console.log(`[VariantWeightEditService] Using REST API to process product ${productId}`);
          
          // D'abord, récupérer les informations sur le produit via REST pour obtenir les variantes
          const shop = session.shop;
          const token = session.accessToken;
          
          if (!token) {
            throw new Error("Token d'accès Shopify non disponible");
          }
          
          try {
            // Récupérer le produit pour obtenir le titre
            const productResponse = await fetch(
              `https://${shop}/admin/api/2023-10/products/${productId}.json`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Access-Token': token
                }
              }
            );
            
            if (!productResponse.ok) {
              throw new Error(`Échec de la récupération du produit via REST: ${productResponse.statusText}`);
            }
            
            const productData = await productResponse.json();
            const productTitle = productData.product?.title || `Product ${productId}`;
            
            // Récupérer les variantes du produit
            const variantsResponse = await fetch(
              `https://${shop}/admin/api/2023-10/products/${productId}/variants.json`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Access-Token': token
                }
              }
            );
            
            if (!variantsResponse.ok) {
              throw new Error(`Échec de la récupération des variantes via REST: ${variantsResponse.statusText}`);
            }
            
            const variantsData = await variantsResponse.json();
            const variants = variantsData.variants || [];
            
            if (variants.length === 0) {
              console.log(`[VariantWeightEditService] Product ${productId} has no variants, skipping`);
              return {
                productId,
                productTitle,
                success: false,
                userErrors: [{ message: 'No variants found' }],
                skipped: true
              };
            }
            
            console.log(`[VariantWeightEditService] Found ${variants.length} variants for product ${productId} using REST API`);
            
            // Traiter chaque variante avec REST API
            const variantUpdates = await Promise.all(
              variants.map(async (variant: any) => {
                try {
                  // Convertir l'ID au format gid pour compatibilité avec le reste du code
                  const variantGid = `gid://shopify/ProductVariant/${variant.id}`;
                  console.log(`[VariantWeightEditService] Processing variant ${variant.id} (${variantGid}) with REST method`);
                  
                  const result = await fallbackUpdateVariantWeight(
                    variantGid, 
                    editMode === 'weight' ? weightValue : null, 
                    weightUnit
                  );
                  
                  if (result.success) {
                    console.log(`[VariantWeightEditService] Weight successfully updated for variant ${variant.id}`);
                    return {
                      variantId: variantGid,
                      originalWeight: result.originalWeight || '0',
                      originalWeightUnit: result.originalWeightUnit || 'g',
                      newWeight: result.weight,
                      newWeightUnit: result.weight_unit,
                      userErrors: [],
                      skipped: false
                    };
                  } else {
                    console.error(`[VariantWeightEditService] Failed to update weight for variant ${variant.id}:`, result.error);
                    return {
                      variantId: variantGid,
                      originalWeight: '0',
                      originalWeightUnit: 'g',
                      newWeight: '0',
                      newWeightUnit: 'g',
                      userErrors: [{ message: `Failed to update weight: ${result.error}` }],
                      skipped: true
                    };
                  }
                } catch (error) {
                  console.error(`[VariantWeightEditService] Error updating variant:`, error);
                  return {
                    variantId: `gid://shopify/ProductVariant/${variant.id}`,
                    originalWeight: '0',
                    originalWeightUnit: 'g',
                    newWeight: '0',
                    newWeightUnit: 'g',
                    userErrors: [{ message: error instanceof Error ? error.message : 'Unknown error during update' }],
                    skipped: true
                  };
                }
              })
            );
            
            // Vérifier si des variantes ont été mises à jour avec succès
            const updatedVariants = variantUpdates.filter(update => !update.skipped);
            const hasSuccessfulUpdates = updatedVariants.length > 0;
            
            return {
              productId,
              productTitle,
              success: hasSuccessfulUpdates,
              variantUpdates,
              skipped: false
            };
          } catch (error) {
            console.error(`[VariantWeightEditService] Error processing product ${productId} with REST:`, error);
            return {
              productId,
              productTitle: `Product ${productId}`,
              success: false,
              userErrors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
              skipped: true
            };
          }
        }
        
        // Sinon, utiliser GraphQL comme précédemment
        // First get the current product variants
        console.log(`[VariantWeightEditService] Fetching variants for product ${productId} using GraphQL`);
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
                      measurement {
                        weight {
                          value
                          unit
                        }
                      }
                      tracked
                      requiresShipping
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
        console.log('[VariantWeightEditService] GraphQL response:', JSON.stringify(productData, null, 2));

        // Si GraphQL ne retourne pas les données de poids, utiliser l'API REST
        if (!productData.data?.product?.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight) {
          console.log('[VariantWeightEditService] Weight data not found in GraphQL response, using REST API');
          
          const shop = session.shop;
          const token = session.accessToken;
          
          if (!token) {
            throw new Error("Token d'accès Shopify non disponible");
          }
          
          // Récupérer les variantes via l'API REST
          const variantsResponse = await fetch(
            `https://${shop}/admin/api/2023-10/products/${productId}/variants.json`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': token
              }
            }
          );
          
          if (!variantsResponse.ok) {
            throw new Error(`Échec de la récupération des variantes via REST: ${variantsResponse.statusText}`);
          }
          
          const variantsData = await variantsResponse.json();
          console.log('[VariantWeightEditService] REST API variants response:', JSON.stringify(variantsData, null, 2));
          
          // Mapper les variantes REST vers le format attendu
          const variants = variantsData.variants.map((variant: any) => ({
            id: `gid://shopify/ProductVariant/${variant.id}`,
            title: variant.title,
            weight: variant.weight,
            weightUnit: variant.weight_unit
          }));
          
          // Mettre à jour productData avec les données REST
          productData.data = {
            product: {
              ...productData.data?.product,
              variants: {
                edges: variants.map((v: any) => ({ node: v }))
              }
            }
          };
        }

        // Si GraphQL a fonctionné ou après la récupération REST, continuer avec le traitement normal
        const variants = productData.data.product.variants.edges.map((edge: any) => {
          const variant = edge.node;
          console.log('Processing variant:', variant);
          
          // Extract weight info from the variant - could be from GraphQL or REST
          let weight = '0';
          let weightUnit = 'g';
          
          if (variant.inventoryItem?.measurement?.weight) {
            // GraphQL structure
            weight = variant.inventoryItem.measurement.weight.value.toString();
            weightUnit = variant.inventoryItem.measurement.weight.unit.toLowerCase();
            
            // Normalize unit
            switch (weightUnit) {
              case 'grams': weightUnit = 'g'; break;
              case 'kilograms': weightUnit = 'kg'; break;
              case 'ounces': weightUnit = 'oz'; break;
              case 'pounds': weightUnit = 'lb'; break;
            }
          } else if (variant.weight !== undefined) {
            // REST structure
            weight = variant.weight.toString();
            weightUnit = (variant.weightUnit || variant.weight_unit || 'g').toLowerCase();
          }
          
          return {
            id: variant.id,
            title: variant.title,
            weight: weight,
            weightUnit: weightUnit
          };
        });

        console.log('[VariantWeightEditService] Processed variants:', JSON.stringify(variants, null, 2));
        
        // Skip product if it has no variants
        if (variants.length === 0) {
          console.log(`[VariantWeightEditService] Product ${productId} has no variants, skipping`);
          return {
            productId,
            success: false,
            userErrors: [{ message: 'No variants found' }],
            skipped: true
          };
        }

        // Process each variant to update its weight
        const variantUpdates = await Promise.all(
          variants.map(async (variant: any) => {
            const originalWeight = variant.weight?.toString() || '0';
            const originalWeightUnit = variant.weightUnit?.toLowerCase() || 'g';
            const newWeight = weightValue !== null ? weightValue : originalWeight;
            const newWeightUnit = weightUnit;
            
            // Skip update if nothing changes
            if (editMode === 'weight') {
              // En mode 'weight', on vérifie le poids et l'unité
              if (originalWeight === newWeight && originalWeightUnit === newWeightUnit) {
                console.log(`[VariantWeightEditService] Variant ${variant.id} already has weight ${newWeight} ${newWeightUnit}, skipping update`);
                return {
                  variantId: variant.id,
                  originalWeight,
                  originalWeightUnit,
                  newWeight,
                  newWeightUnit,
                  userErrors: [],
                  skipped: true
                };
              }
            } else {
              // En mode 'weightUnit', on vérifie seulement l'unité
              if (originalWeightUnit === newWeightUnit) {
                console.log(`[VariantWeightEditService] Variant ${variant.id} already has weight unit ${newWeightUnit}, skipping update`);
                return {
                  variantId: variant.id,
                  originalWeight,
                  originalWeightUnit,
                  newWeight: originalWeight,
                  newWeightUnit,
                  userErrors: [],
                  skipped: true
                };
              }
            }
            
            // Vérifier que l'ID du variant est au bon format
            if (!variant.id.startsWith('gid://')) {
              console.error(`[VariantWeightEditService] Variant ID ${variant.id} n'est pas au format attendu (gid://). Impossible de mettre à jour.`);
              return {
                variantId: variant.id,
                originalWeight,
                originalWeightUnit,
                newWeight: originalWeight,
                newWeightUnit: originalWeightUnit,
                userErrors: [{ message: `Invalid variant ID format: ${variant.id}` }],
                skipped: true
              };
            }
            
            // Utiliser directement l'API REST pour la mise à jour
            if (editMode === 'weight') {
              console.log(`[VariantWeightEditService] Updating weight from ${originalWeight} ${originalWeightUnit} to ${newWeight} ${newWeightUnit} for variant ${variant.id}`);
            } else {
              console.log(`[VariantWeightEditService] Updating weight unit from ${originalWeightUnit} to ${newWeightUnit} for variant ${variant.id}`);
            }
            
            try {
              // Utiliser uniquement la méthode REST, qui fonctionne de manière fiable
              // La méthode GraphQL n'est pas utilisée car elle cause l'erreur "Field 'weight' doesn't exist on type 'ProductVariant'"
              const result = await fallbackUpdateVariantWeight(
                variant.id, 
                editMode === 'weight' ? newWeight : null, 
                newWeightUnit
              );
              
              if (result.success) {
                console.log(`[VariantWeightEditService] Weight successfully updated for variant ${variant.id}`);
                return {
                  variantId: variant.id,
                  originalWeight,
                  originalWeightUnit,
                  newWeight: result.weight,
                  newWeightUnit: result.weight_unit,
                  userErrors: [],
                  skipped: false
                };
              } else {
                console.error(`[VariantWeightEditService] Failed to update weight for variant ${variant.id}:`, result.error);
                return {
                  variantId: variant.id,
                  originalWeight,
                  originalWeightUnit,
                  newWeight: originalWeight,
                  newWeightUnit: originalWeightUnit,
                  userErrors: [{ message: `Failed to update weight: ${result.error}` }],
                  skipped: true
                };
              }
            } catch (error) {
              console.error(`[VariantWeightEditService] Error updating variant ${variant.id}:`, error);
              return {
                variantId: variant.id,
                originalWeight,
                originalWeightUnit,
                newWeight: originalWeight,
                newWeightUnit: originalWeightUnit,
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
      console.error('[VariantWeightEditService] Errors found in results:', errors);
      return json({
        error: `Failed to update some variants: ${errors.map(e => e.message).join(', ')}`,
        success: true,
        partialFailure: true,
        message: `Updated ${totalVariantsUpdated} variants across ${processedProducts} products with some errors.`
      });
    }

    console.log(`[VariantWeightEditService] Variant weight update completed: ${totalVariantsUpdated} variants updated across ${processedProducts} products`);
    
    // Construire le message de succès en fonction du mode d'édition
    const successMessage = editMode === 'weight'
      ? `Variant weight updated successfully!`
      : `Variant weight units updated successfully!`;
    
    return json({
      success: true,
      message: successMessage,
      results: results.map(result => ({
        productId: result.productId,
        productTitle: result.productTitle,
        variantUpdates: (result.variantUpdates || []).map((v: any) => ({
          variantId: v.variantId,
          originalWeight: v.originalWeight,
          originalWeightUnit: v.originalWeightUnit,
          newWeight: v.newWeight,
          newWeightUnit: v.newWeightUnit,
          skipped: v.skipped
        }))
      }))
    });
  } catch (error) {
    console.error('[VariantWeightEditService] Error updating variant weights:', error);
    return json({
      error: 'Failed to update product variant weights',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 