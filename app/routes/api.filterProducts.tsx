/**
 * API route dédiée pour filtrer les produits avec leurs poids de variante
 * Utilise exclusivement l'API REST Shopify (pas GraphQL)
 */

import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

// Define a product interface
interface ShopifyProduct {
  id: number | string;
  title: string;
  body_html?: string;
  product_type?: string;
  vendor?: string;
  status?: string;
  image?: {
    src: string;
    alt?: string;
  };
  variants: Array<{
    id: number | string;
    title?: string;
    price?: string;
    weight?: number | null;
    weight_unit?: string;
  }>;
}

// Add a loader function to handle GET requests and ensure authentication
export async function loader({ request }: LoaderFunctionArgs) {
  // Verify authentication before proceeding
  await authenticate.admin(request);
  
  // If no specific GET functionality is needed, redirect to the bulk edit page
  return redirect("/app/bulkEdit?section=variantWeight");
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    console.log("[api.filterProducts] Received request");
    
    // Verify authentication first to catch any auth issues early
    let adminSession;
    try {
      adminSession = await authenticate.admin(request);
      console.log("[api.filterProducts] Authentication successful");
    } catch (authError) {
      console.error("[api.filterProducts] Authentication error:", authError);
      return json({ 
        error: "Authentication failed. Please log in again.",
        details: authError instanceof Error ? authError.message : "Unknown auth error",
        success: false
      }, { status: 401 });
    }
    
    const { admin, session } = adminSession;
    const formData = await request.formData();
    
    // Récupérer les paramètres de filtrage
    const filterType = formData.get("filterType") as string || "title";
    const searchValue = formData.get("searchValue") as string || "";
    const condition = formData.get("condition") as string || "contains";
    
    console.log(`[api.filterProducts] Filtering products: ${filterType}=${searchValue} (${condition})`);
    
    // Obtenir les détails pour l'API REST
    const shop = session.shop;
    const token = session.accessToken;
    
    console.log(`[api.filterProducts] Shop: ${shop}`);
    
    if (!token) {
      console.error("[api.filterProducts] Access token not available");
      return json({ 
        error: "Shopify access token not available",
        success: false
      }, { status: 401 });
    }
    
    // Construire la requête REST API basée sur les critères de filtrage
    let endpoint = `https://${shop}/admin/api/2023-10/products.json?limit=20`;
    
    // Ajouter le filtre de recherche si spécifié
    if (filterType && searchValue) {
      if (filterType === 'productId') {
        // Pour les IDs, interroger directement le produit
        endpoint = `https://${shop}/admin/api/2023-10/products/${searchValue}.json`;
      } else {
        // Pour les autres types, construire une requête de filtrage appropriée
        let queryParam = "";
        
        switch (filterType) {
          case 'title':
            queryParam = `title=${encodeURIComponent(searchValue)}`;
            break;
          case 'description':
            // REST API n'a pas de filtre direct pour la description, nous filtrerons manuellement plus tard
            break;
          case 'productType':
            queryParam = `product_type=${encodeURIComponent(searchValue)}`;
            break;
          case 'vendor':
            queryParam = `vendor=${encodeURIComponent(searchValue)}`;
            break;
          default:
            // Pour les autres filtres, utiliser la recherche générale
            queryParam = `${filterType}=${encodeURIComponent(searchValue)}`;
        }
        
        if (queryParam) {
          endpoint = `https://${shop}/admin/api/2023-10/products.json?${queryParam}&limit=20`;
        }
      }
    }
    
    console.log(`[api.filterProducts] Using REST endpoint: ${endpoint}`);
    
    // Effectuer la requête REST
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      }
    });
    
    if (!response.ok) {
      console.error(`[api.filterProducts] REST API error: ${response.statusText}`);
      return json({ 
        error: `Failed to fetch products: ${response.statusText}`,
        success: false
      }, { status: response.status });
    }
    
    const responseData = await response.json();
    
    // Traiter soit un produit unique, soit une liste
    let products: ShopifyProduct[] = [];
    if (filterType === 'productId') {
      // Format de réponse pour un produit unique
      products = [responseData.product];
    } else {
      // Format de réponse pour une liste de produits
      products = responseData.products || [];
    }
    
    // Filtrer manuellement pour les descriptions si nécessaire
    if (filterType === 'description' && searchValue && products.length > 0) {
      products = products.filter((product: ShopifyProduct) => {
        const description = (product.body_html || "").toLowerCase();
        const search = searchValue.toLowerCase();
        
        switch (condition) {
          case 'contains':
            return description.includes(search);
          case 'doesNotContain':
            return !description.includes(search);
          case 'startsWith':
            return description.startsWith(search);
          case 'endsWith':
            return description.endsWith(search);
          case 'empty':
            return !description || description.trim() === '';
          default:
            return true;
        }
      });
    }
    
    console.log(`[api.filterProducts] Found ${products.length} products`);
    
    // Pour chaque produit, récupérer les variantes avec leurs poids
    const productsWithDetails = await Promise.all(
      products.map(async (product: ShopifyProduct) => {
        // Les variantes sont déjà disponibles dans la réponse du produit
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
      })
    );
    
    return json({
      success: true,
      data: {
        filtered_products: productsWithDetails
      }
    });
  } catch (error) {
    console.error('[api.filterProducts] Error:', error);
    return json({ 
      error: error instanceof Error ? error.message : "An unknown error occurred",
      success: false
    }, { status: 500 });
  }
} 