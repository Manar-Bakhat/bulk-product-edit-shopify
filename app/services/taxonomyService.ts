/**
 * Service de taxonomie Shopify
 * Ce service gère la récupération et le traitement des catégories de taxonomie de produits Shopify
 */

import fs from 'fs';
import path from 'path';

// Types pour la taxonomie hiérarchique
export interface TaxonomyNode {
  id: string;
  name: string;
  fullPath: string;
  children: TaxonomyNode[];
  level: number;
}

// Cache des données
let taxonomyTreeCache: TaxonomyNode[] | null = null;
let flatCategoriesCache: { label: string; value: string }[] | null = null;

/**
 * Lit le contenu du fichier taxonomyCategory.txt
 */
function readTaxonomyCategoryFile(): string {
  try {
    // Accéder directement au fichier à partir du dossier components
    const filePath = path.resolve(process.cwd(), 'app/components/taxonomyCategory.txt');
    if (fs.existsSync(filePath)) {
      console.log('[TaxonomyService] Reading taxonomy file from:', filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Log des premières lignes pour le débogage
      const firstLines = content.split('\n').slice(0, 30).join('\n');
      console.log('[TaxonomyService] First 30 lines of the file:\n', firstLines);
      
      return content;
    }
    
    // Essayer avec l'ancien nom de fichier si le nouveau n'existe pas
    const legacyFilePath = path.resolve(process.cwd(), 'app/components/taxonamyCategory.txt');
    if (fs.existsSync(legacyFilePath)) {
      console.log('[TaxonomyService] Reading taxonomy file from legacy path:', legacyFilePath);
      const content = fs.readFileSync(legacyFilePath, 'utf8');
      
      const firstLines = content.split('\n').slice(0, 30).join('\n');
      console.log('[TaxonomyService] First 30 lines of the file (legacy):\n', firstLines);
      
      return content;
    }
    
    console.error('[TaxonomyService] Taxonomy file not found at any path');
    return "";
  } catch (error) {
    console.error('[TaxonomyService] Error reading taxonomy file:', error);
    return "";
  }
}

/**
 * Construit un arbre hiérarchique à partir des catégories plates
 */
function buildTaxonomyTree(categories: { id: string; name: string }[]): TaxonomyNode[] {
  console.log(`[TaxonomyService] Building tree from ${categories.length} categories`);
  
  // Map pour stocker toutes les catégories par leur chemin complet
  const pathMap: { [path: string]: TaxonomyNode } = {};
  const rootNodes: TaxonomyNode[] = [];

  // Première passe: créer les nœuds pour toutes les catégories
  categories.forEach(category => {
    const pathParts = category.name.split(' > ');
    const level = pathParts.length - 1;
    const name = pathParts[level];
    
    const node: TaxonomyNode = {
      id: category.id,
      name,
      fullPath: category.name,
      children: [],
      level
    };
    
    pathMap[category.name] = node;
    
    // Ajouter à la racine si c'est un nœud de premier niveau
    if (level === 0) {
      rootNodes.push(node);
    }
  });
  
  console.log(`[TaxonomyService] Found ${rootNodes.length} root categories`);
  
  // Deuxième passe: établir les relations parent-enfant
  categories.forEach(category => {
    const pathParts = category.name.split(' > ');
    
    // Ignorer les nœuds racine qui n'ont pas de parent
    if (pathParts.length <= 1) return;
    
    // Construire le chemin du parent
    const parentPath = pathParts.slice(0, -1).join(' > ');
    const parentNode = pathMap[parentPath];
    const currentNode = pathMap[category.name];
    
    if (parentNode && currentNode) {
      parentNode.children.push(currentNode);
    }
  });
  
  // Trier les nœuds et leurs enfants par nom
  const sortNodes = (nodes: TaxonomyNode[]): TaxonomyNode[] => {
    return nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(node => ({
        ...node,
        children: sortNodes(node.children)
      }));
  };
  
  return sortNodes(rootNodes);
}

/**
 * Convertit un arbre taxonomique en liste plate pour l'Autocomplete
 */
function flattenTaxonomyTree(tree: TaxonomyNode[]): { label: string; value: string }[] {
  const result: { label: string; value: string }[] = [];
  
  function traverse(node: TaxonomyNode) {
    result.push({
      label: node.fullPath,
      value: node.id
    });
    
    node.children.forEach(child => traverse(child));
  }
  
  tree.forEach(node => traverse(node));
  return result;
}

/**
 * Récupère l'arbre complet de taxonomie depuis le fichier local taxonomyCategory.txt
 */
export async function getTaxonomyTree(): Promise<TaxonomyNode[]> {
  if (taxonomyTreeCache) {
    return taxonomyTreeCache;
  }
  
  try {
    console.log('[TaxonomyService] Loading taxonomy from local file...');
    
    // Lire le fichier local
    const text = readTaxonomyCategoryFile();
    console.log(`[TaxonomyService] Received taxonomy data: ${text.length} bytes`);
    
    if (!text || text.length < 100) {
      console.error('[TaxonomyService] Received empty or invalid taxonomy data');
      throw new Error('Invalid taxonomy data');
    }
    
    // Traiter le fichier texte (format: gid://shopify/TaxonomyCategory/ap : Animals & Pet Supplies)
    const rawCategories = text
      .split('\n')
      .filter(line => line.trim().length > 0 && !line.startsWith('#')) // Ignorer les commentaires et lignes vides
      .map(line => {
        const match = line.match(/^(gid:\/\/shopify\/TaxonomyCategory\/[^\s]+)\s+:\s+(.+)$/);
        if (match) {
          const [, id, name] = match;
          return {
            id: id.trim(),
            name: name.trim()
          };
        }
        return null;
      })
      .filter((category): category is { id: string; name: string } => category !== null);
    
    console.log(`[TaxonomyService] Parsed ${rawCategories.length} categories from file`);
    
    // Identifier les catégories principales (qui n'ont pas de ">" dans le nom)
    const rootCategories = rawCategories.filter(cat => !cat.name.includes(' > '));
    console.log(`[TaxonomyService] Identified ${rootCategories.length} root categories:`);
    rootCategories.forEach(cat => console.log(`- ${cat.name} (${cat.id})`));
    
    if (rawCategories.length < 20) {
      console.error('[TaxonomyService] Too few categories found, using fallback');
      return getBasicCategories();
    }
    
    // Construire l'arbre taxonomique
    const treeData = buildTaxonomyTree(rawCategories);
    taxonomyTreeCache = treeData;
    
    // Mettre également à jour le cache plat
    flatCategoriesCache = flattenTaxonomyTree(treeData);
    
    console.log(`[TaxonomyService] Successfully built taxonomy tree with ${treeData.length} root categories`);
    return treeData;
  } catch (error) {
    console.error('[TaxonomyService] Error retrieving categories:', error);
    // Retourner un arbre basique en cas d'erreur
    return getBasicCategories();
  }
}

/**
 * Version pour Autocomplete: retourne une liste plate
 */
export async function getShopifyTaxonomyCategories(): Promise<{ label: string; value: string }[]> {
  if (flatCategoriesCache) {
    return flatCategoriesCache;
  }
  
  // Si le cache n'est pas disponible, récupérer l'arbre puis l'aplatir
  const tree = await getTaxonomyTree();
  flatCategoriesCache = flattenTaxonomyTree(tree);
  return flatCategoriesCache;
}

/**
 * Retourne un ensemble basique de catégories si le chargement normal échoue
 */
export function getBasicCategories(): TaxonomyNode[] {
  console.log('[TaxonomyService] Using fallback basic categories');
  
  // Inclure les 26 catégories principales de Shopify
  return [
    {
      id: "gid://shopify/TaxonomyCategory/ap",
      name: "Animals & Pet Supplies",
      fullPath: "Animals & Pet Supplies",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ad",
      name: "Apparel & Accessories",
      fullPath: "Apparel & Accessories",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ab",
      name: "Arts & Entertainment",
      fullPath: "Arts & Entertainment",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ba",
      name: "Baby & Toddler",
      fullPath: "Baby & Toddler",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/bu",
      name: "Business & Industrial",
      fullPath: "Business & Industrial",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/cm",
      name: "Cameras & Optics",
      fullPath: "Cameras & Optics",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/el",
      name: "Electronics",
      fullPath: "Electronics",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/fo",
      name: "Food, Beverages & Tobacco",
      fullPath: "Food, Beverages & Tobacco",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/fu",
      name: "Furniture",
      fullPath: "Furniture",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ha",
      name: "Hardware",
      fullPath: "Hardware",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/he",
      name: "Health & Beauty",
      fullPath: "Health & Beauty",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ho",
      name: "Home & Garden",
      fullPath: "Home & Garden",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/lu",
      name: "Luggage & Bags",
      fullPath: "Luggage & Bags",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ma",
      name: "Mature",
      fullPath: "Mature",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/me",
      name: "Media",
      fullPath: "Media",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/of",
      name: "Office Supplies",
      fullPath: "Office Supplies",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/re",
      name: "Religious & Ceremonial",
      fullPath: "Religious & Ceremonial",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/so",
      name: "Software",
      fullPath: "Software",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/sp",
      name: "Sporting Goods",
      fullPath: "Sporting Goods",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/to",
      name: "Toys & Games",
      fullPath: "Toys & Games",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ve",
      name: "Vehicles & Parts",
      fullPath: "Vehicles & Parts",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/other",
      name: "Other",
      fullPath: "Other",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/services",
      name: "Services",
      fullPath: "Services",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/crafts",
      name: "Crafts",
      fullPath: "Crafts",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/phone",
      name: "Phone & Telecommunications",
      fullPath: "Phone & Telecommunications",
      level: 0,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/home_improvement",
      name: "Home Improvement",
      fullPath: "Home Improvement",
      level: 0,
      children: []
    }
  ];
}
