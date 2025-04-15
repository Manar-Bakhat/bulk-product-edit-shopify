/**
 * API route pour récupérer les poids des variantes de produits
 * Point d'accès séparé pour éviter de modifier app.bulkEdit.tsx
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Utiliser le service existant plutôt que l'inexistant variantWeightService
export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const { admin, session } = await authenticate.admin(request);
    
    // Mode de recherche directe par terme
    const directSearch = formData.get("directSearch") === "true";
    
    if (directSearch) {
      const filterType = formData.get("filterType") as string;
      const searchTerm = formData.get("searchTerm") as string;
      
      if (!filterType || !searchTerm) {
        return json({ 
          error: "Missing required parameters for direct search: filterType and searchTerm",
          success: false
        }, { status: 400 });
      }
      
      console.log(`[api.getProductWeights] Direct search: ${filterType}=${searchTerm}`);
      
      // Obtenir les détails pour effectuer l'appel API
      const shop = session.shop;
      const token = session.accessToken;
      
      if (!token) {
        return json({ 
          error: "Shopify access token not available",
          success: false
        }, { status: 401 });
      }
      
      // Construire la requête REST API basée sur les critères de filtrage
      let endpoint = `https://${shop}/admin/api/2023-10/products.json?limit=20`;
      
      // Ajouter le filtre de recherche si spécifié
      if (filterType === 'title') {
        endpoint = `https://${shop}/admin/api/2023-10/products.json?title=${encodeURIComponent(searchTerm)}&limit=20`;
      } else if (filterType === 'productId') {
        endpoint = `https://${shop}/admin/api/2023-10/products/${encodeURIComponent(searchTerm)}.json`;
      }
      
      console.log(`[api.getProductWeights] Using REST endpoint: ${endpoint}`);
      
      // Effectuer la requête REST
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token
        }
      });
      
      if (!response.ok) {
        console.error(`[api.getProductWeights] REST API error: ${response.statusText}`);
        return json({ 
          error: `Failed to fetch products: ${response.statusText}`,
          success: false
        }, { status: response.status });
      }
      
      const responseData = await response.json();
      
      // Traiter soit un produit unique, soit une liste
      let products = [];
      if (filterType === 'productId') {
        // Format de réponse pour un produit unique
        products = [responseData.product];
      } else {
        // Format de réponse pour une liste de produits
        products = responseData.products || [];
      }
      
      console.log(`[api.getProductWeights] Found ${products.length} products via REST API`);
      
      // Pour chaque produit, nous avons déjà les variantes avec leurs poids
      const productsWithWeights = products.map((product: any) => {
        // Extraire les détails des poids des variantes
        const variantDetails = product.variants.map((variant: any) => ({
          id: variant.id,
          title: variant.title,
          weight: variant.weight,
          weight_unit: variant.weight_unit
        }));
        
        // Formater le produit pour qu'il corresponde au format attendu
        return {
          id: product.id.toString(),
          title: product.title,
          description: product.body_html || '',
          productType: product.product_type || '',
          vendor: product.vendor || '',
          status: (product.status || 'active').toUpperCase(),
          featuredImage: product.image ? {
            url: product.image.src,
            altText: product.image.alt || ''
          } : undefined,
          priceRangeV2: {
            minVariantPrice: {
              amount: product.variants?.[0]?.price || "0.00",
              currencyCode: "USD"
            }
          },
          variant_details: variantDetails
        };
      });
      
      return json({
        success: true,
        data: {
          products_with_weights: productsWithWeights
        }
      });
    }
    
    // Mode standard par liste d'IDs
    const productIdsJson = formData.get("productIds") as string;
    
    if (!productIdsJson) {
      return json({ 
        error: "Missing required parameter: productIds",
        success: false
      }, { status: 400 });
    }
    
    const productIds = JSON.parse(productIdsJson);
    
    if (!Array.isArray(productIds)) {
      return json({ 
        error: "Invalid productIds format: must be an array",
        success: false
      }, { status: 400 });
    }
    
    console.log(`[api.getProductWeights] Fetching weights for ${productIds.length} products`);
    
    // Implémentation directe au lieu d'utiliser le service manquant
    try {
      const productsWithWeights = await getVariantWeightsFromShopify(admin, productIds);
      
      return json({
        success: true,
        data: {
          products_with_weights: productsWithWeights
        }
      });
    } catch (error) {
      console.error('[api.getProductWeights] Error fetching variant weights:', error);
      return json({ 
        error: error instanceof Error ? error.message : "Error retrieving variant weights",
        success: false
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[api.getProductWeights] Error:', error);
    return json({ 
      error: error instanceof Error ? error.message : "An unknown error occurred",
      success: false
    }, { status: 500 });
  }
}

/**
 * Fonction pour récupérer les poids des variantes de produits directement depuis Shopify
 * Remplace l'appel au service manquant
 */
async function getVariantWeightsFromShopify(admin: any, productIds: string[]) {
  console.log(`[getVariantWeightsFromShopify] Fetching weight data for ${productIds.length} products`);
  
  const productsWithWeights = [];
  
  // Traiter chaque produit individuellement pour obtenir ses données de poids
  for (const productId of productIds) {
    try {
      const shopifyProductId = `gid://shopify/Product/${productId}`;
      
      // Requête GraphQL pour obtenir les informations de poids
      const query = `
        query {
          product(id: "${shopifyProductId}") {
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
                  metafields(first: 10) {
                    edges {
                      node {
                        key
                        namespace
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const response = await admin.graphql(query);
      const data = await response.json();
      
      if (data.errors) {
        console.error(`[getVariantWeightsFromShopify] GraphQL errors for product ${productId}:`, data.errors);
        continue;
      }
      
      const product = data.data.product;
      
      if (!product) {
        console.warn(`[getVariantWeightsFromShopify] Product ${productId} not found`);
        continue;
      }
      
      // Extraire les détails des poids des variantes
      const variantDetails = product.variants.edges.map((edge: any) => {
        const variant = edge.node;
        
        // Rechercher les métafields pour weight et weight_unit
        const metafields = variant.metafields?.edges || [];
        const weightMeta = metafields.find((m: any) => m.node.key === 'weight');
        const weightUnitMeta = metafields.find((m: any) => m.node.key === 'weight_unit');
        
        const weightValue = weightMeta ? weightMeta.node.value : '0';
        let weightUnit = weightUnitMeta ? weightUnitMeta.node.value : 'g';
        
        // Conversion des unités API pour l'affichage
        if (weightUnit === 'GRAMS') weightUnit = 'g';
        else if (weightUnit === 'KILOGRAMS') weightUnit = 'kg';
        else if (weightUnit === 'OUNCES') weightUnit = 'oz';
        else if (weightUnit === 'POUNDS') weightUnit = 'lb';
        
        return {
          id: variant.id,
          title: variant.title || 'Default Title',
          weight: weightValue,
          weight_unit: weightUnit
        };
      });
      
      // Formater le produit pour qu'il corresponde au format attendu
      productsWithWeights.push({
        id: productId,
        title: product.title,
        description: product.description || '',
        productType: product.productType || '',
        vendor: product.vendor || '',
        status: product.status || 'ACTIVE',
        featuredImage: product.featuredImage,
        priceRangeV2: product.priceRangeV2,
        variant_details: variantDetails
      });
      
    } catch (error) {
      console.error(`[getVariantWeightsFromShopify] Error processing product ${productId}:`, error);
    }
  }
  
  return productsWithWeights;
} 