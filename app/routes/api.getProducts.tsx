/**
 * API route to get products with their variant weights 
 * This route fetches products using the Shopify REST API and includes variant weight information
 */

import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin, session } = await authenticate.admin(request);
    console.log('[API getProducts] Processing request to fetch products');
    
    const formData = await request.formData();
    const filterType = formData.get("filterType") as string;
    const searchText = formData.get("searchText") as string;
    const fetchAllProducts = formData.get("fetchAllProducts") === "true";
    const fetchWeightsOnly = formData.get("fetchWeightsOnly") === "true";
    const productIdsJson = formData.get("productIds") as string;
    
    // Mode spécial pour récupérer uniquement les poids de variantes pour une liste de produits
    if (fetchWeightsOnly && productIdsJson) {
      console.log('[API getProducts] Fetching weights only for specific products');
      const productIds = JSON.parse(productIdsJson);
      
      // Get shop domain and access token for REST API calls
      const shop = session.shop;
      const token = session.accessToken;
      
      if (!token) {
        return json({ 
          error: "Shopify access token not available",
          success: false
        }, { status: 401 });
      }
      
      // Fetch variant weights for each product
      const productsWithWeights = await Promise.all(
        productIds.map(async (productId: string) => {
          // Get product data first
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
            console.error(`[API getProducts] Error fetching product ${productId}: ${productResponse.statusText}`);
            return null;
          }
          
          const productData = await productResponse.json();
          const product = productData.product;
          
          // Get variants for this product
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
            console.error(`[API getProducts] Error fetching variants for product ${productId}: ${variantsResponse.statusText}`);
            return product;
          }
          
          const variantsData = await variantsResponse.json();
          
          // Add variant weight details to the product
          const variant_details = variantsData.variants.map((variant: any) => ({
            id: variant.id,
            weight: variant.weight,
            weight_unit: variant.weight_unit
          }));
          
          return {
            ...product,
            variant_details
          };
        })
      );
      
      // Filtrer les produits null
      const validProducts = productsWithWeights.filter(product => product !== null);
      
      console.log(`[API getProducts] Successfully processed ${validProducts.length} products with variant weights`);
      
      return json({
        success: true,
        data: {
          rest_products: validProducts
        }
      });
    }
    
    console.log('[API getProducts] Search params:', { filterType, searchText, fetchAllProducts });
    
    // Get shop domain and access token for REST API calls
    const shop = session.shop;
    const token = session.accessToken;
    
    if (!token) {
      return json({ 
        error: "Shopify access token not available",
        success: false
      }, { status: 401 });
    }
    
    // Construct the REST API endpoint based on the search parameters
    let endpoint = `https://${shop}/admin/api/2023-10/products.json?limit=50`;
    
    // Construire la requête pour l'API GraphQL
    let graphqlQuery = `
      query {
        products(first: 50) {
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
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryItem {
                      unitCost {
                        amount
                        currencyCode
                      }
                      tracked
                      requiresShipping
                      measurement {
                        weight {
                          value
                          unit
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    if (!fetchAllProducts && filterType && searchText) {
      // Filter by product ID if specified
      if (filterType === 'productId') {
        endpoint = `https://${shop}/admin/api/2023-10/products/${searchText}.json`;
      } else {
        // Otherwise add a filter query
        let filterQueryParam = '';
        
        switch (filterType) {
          case 'title':
            filterQueryParam = `title=${encodeURIComponent(searchText)}`;
            break;
          case 'description':
            filterQueryParam = `product_type=${encodeURIComponent(searchText)}`;
            break;
          default:
            filterQueryParam = `${filterType}=${encodeURIComponent(searchText)}`;
        }
        
        endpoint = `https://${shop}/admin/api/2023-10/products.json?${filterQueryParam}&limit=50`;
      }
    }
    
    console.log(`[API getProducts] Requesting products from endpoint: ${endpoint}`);
    
    // Call the REST API to get products
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      }
    });
    
    if (!response.ok) {
      console.error(`[API getProducts] Error fetching products: ${response.statusText}`);
      return json({ 
        error: `Failed to fetch products: ${response.statusText}`,
        success: false
      }, { status: response.status });
    }
    
    // Parse the API response
    const productsData = await response.json();
    let products = filterType === 'productId' ? [productsData.product] : productsData.products;
    
    console.log(`[API getProducts] Retrieved ${products.length} products`);
    
    // Fetch variant weights for each product
    const productsWithWeights = await Promise.all(
      products.map(async (product: any) => {
        // Get variants for this product
        const variantsResponse = await fetch(
          `https://${shop}/admin/api/2023-10/products/${product.id}/variants.json`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': token
            }
          }
        );
        
        if (!variantsResponse.ok) {
          console.error(`[API getProducts] Error fetching variants for product ${product.id}: ${variantsResponse.statusText}`);
          // Continue with original product data even if variant fetch fails
          return {
            ...product,
            variant_details: []
          };
        }
        
        const variantsData = await variantsResponse.json();
        
        // Add variant weight details to the product
        const variant_details = variantsData.variants.map((variant: any) => ({
          id: variant.id,
          weight: variant.weight,
          weight_unit: variant.weight_unit
        }));
        
        return {
          ...product,
          variant_details
        };
      })
    );
    
    console.log(`[API getProducts] Successfully processed ${productsWithWeights.length} products with variant weights`);
    
    return json({
      success: true,
      data: {
        rest_products: productsWithWeights
      }
    });
    
  } catch (error) {
    console.error('[API getProducts] Error:', error);
    return json({ 
      error: error instanceof Error ? error.message : "An unknown error occurred",
      success: false
    }, { status: 500 });
  }
} 