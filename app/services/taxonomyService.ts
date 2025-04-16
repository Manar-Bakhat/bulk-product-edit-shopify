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
 * Retourne les catégories détaillées pour Pet Supplies
 */
function getDetailedPetSuppliesCategories(): TaxonomyNode[] {
  return [
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-1",
      name: "Bird Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-1",
          name: "Bird Cage Accessories",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cage Accessories",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-1-1",
              name: "Bird Cage Bird Baths",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cage Accessories > Bird Cage Bird Baths",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-1-2",
              name: "Bird Cage Food & Water Dishes",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cage Accessories > Bird Cage Food & Water Dishes",
              level: 4,
              children: [
                {
                  id: "gid://shopify/TaxonomyCategory/ap-2-1-1-2-1",
                  name: "Bird Cage Food Dishes",
                  fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cage Accessories > Bird Cage Food & Water Dishes > Bird Cage Food Dishes",
                  level: 5,
                  children: []
                },
                {
                  id: "gid://shopify/TaxonomyCategory/ap-2-1-1-2-2",
                  name: "Bird Cage Water Dishes",
                  fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cage Accessories > Bird Cage Food & Water Dishes > Bird Cage Water Dishes",
                  level: 5,
                  children: []
                },
                {
                  id: "gid://shopify/TaxonomyCategory/ap-2-1-1-2-3",
                  name: "Combined Bird Cage Food & Water Dishes",
                  fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cage Accessories > Bird Cage Food & Water Dishes > Combined Bird Cage Food & Water Dishes",
                  level: 5,
                  children: []
                }
              ]
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-2",
          name: "Bird Cages & Stands",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Cages & Stands",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-3",
          name: "Bird Food",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Food",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-4",
          name: "Bird Gyms & Playstands",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Gyms & Playstands",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-5",
          name: "Bird Ladders & Perches",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Ladders & Perches",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-5-1",
              name: "Ladders & Steps",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Ladders & Perches > Ladders & Steps",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-5-2",
              name: "Swings & Perches",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Ladders & Perches > Swings & Perches",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-6",
          name: "Bird Toys",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-1",
              name: "Balls & Fetch Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Balls & Fetch Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-2",
              name: "Bells & Beads",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Bells & Beads",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-3",
              name: "Chew Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Chew Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-4",
              name: "Foraging Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Foraging Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-5",
              name: "Mirrors",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Mirrors",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-7",
              name: "Puzzles & Interactive Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Puzzles & Interactive Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-8",
              name: "Ropes & Knots",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Ropes & Knots",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-1-6-9",
              name: "Tunnels & Tubes",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Toys > Tunnels & Tubes",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-1-7",
          name: "Bird Treats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Bird Supplies > Bird Treats",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-2",
      name: "Cat Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-2-1",
          name: "Cat Food",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Food",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-1-1",
              name: "Non-Prescription Cat Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Food > Non-Prescription Cat Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-1-2",
              name: "Prescription Cat Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Food > Prescription Cat Food",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-2-2",
          name: "Cat Furniture",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-1",
              name: "Cat Condos & Houses",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Cat Condos & Houses",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-2",
              name: "Cat Perches & Shelves",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Cat Perches & Shelves",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-3",
              name: "Cat Scratchers & Scratching Posts",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Cat Scratchers & Scratching Posts",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-4",
              name: "Cat Steps & Ramps",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Cat Steps & Ramps",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-5",
              name: "Cat Trees & Towers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Cat Trees & Towers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-6",
              name: "Cat Window Beds & Perches",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Cat Window Beds & Perches",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-2-7",
              name: "Outdoor Cat Houses",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture > Outdoor Cat Houses",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-2-3",
          name: "Cat Furniture Accessories",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Furniture Accessories",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-2-4",
          name: "Cat Litter",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Litter",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-4-1",
              name: "Cat Litter Box Liners",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Litter > Cat Litter Box Liners",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-4-2",
              name: "Cat Litter Box Mats",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Litter > Cat Litter Box Mats",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-4-3",
              name: "Cat Litter Boxes",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Litter > Cat Litter Boxes",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-2-5",
          name: "Cat Toys",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-1",
              name: "Balls & Chasers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Balls & Chasers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-2",
              name: "Catnip Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Catnip Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-3",
              name: "Chew Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Chew Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-4",
              name: "Feathers & Teasers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Feathers & Teasers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-5",
              name: "Interactive Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Interactive Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-6",
              name: "Laser Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Laser Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-7",
              name: "Puzzles & Treat-Dispensing Toys",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Puzzles & Treat-Dispensing Toys",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-9",
              name: "Squeakies",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Squeakies",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-10",
              name: "Stuffed Toys & Plushies",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Stuffed Toys & Plushies",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-11",
              name: "Tunnels",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Tunnels",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-2-5-12",
              name: "Wands",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Toys > Wands",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-2-6",
          name: "Cat Treats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Cat Supplies > Cat Treats",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-3",
      name: "Dog Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-1",
          name: "Dog Diaper Pads & Liners",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Diaper Pads & Liners",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-2",
          name: "Dog Diapers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Diapers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-3",
          name: "Dog Food",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Food",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-3-1",
              name: "Non-Prescription Dog Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Food > Non-Prescription Dog Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-3-2",
              name: "Prescription Dog Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Food > Prescription Dog Food",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-4",
          name: "Dog Houses",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Houses",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-5",
          name: "Dog Kennel & Run Accessories",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennel & Run Accessories",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-6",
          name: "Dog Kennels & Runs",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-6-1",
              name: "Dog Pens",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs > Dog Pens",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-6-2",
              name: "Dog Runs",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs > Dog Runs",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-6-3",
              name: "Indoor Dog Kennels",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs > Indoor Dog Kennels",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-6-4",
              name: "Outdoor Dog Kennels",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs > Outdoor Dog Kennels",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-3-6-5",
              name: "Portable Dog Kennels",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs > Portable Dog Kennels",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-7",
          name: "Dog Toys",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Toys",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-8",
          name: "Dog Treadmills",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Treadmills",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-3-9",
          name: "Dog Treats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Treats",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-4",
      name: "Fish & Aquatic Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-1",
          name: "Aquarium & Pond Tubings",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium & Pond Tubings",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-1-1",
              name: "Airlines",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium & Pond Tubings > Airlines",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-1-2",
              name: "Coil Tubings",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium & Pond Tubings > Coil Tubings",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-1-3",
              name: "Flexible Tubings",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium & Pond Tubings > Flexible Tubings",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-1-4",
              name: "Rigid Tubings",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium & Pond Tubings > Rigid Tubings",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-1-5",
              name: "Standard Tubings",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium & Pond Tubings > Standard Tubings",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-2",
          name: "Aquarium Air Stones & Diffusers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Air Stones & Diffusers",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-2-1",
              name: "Air Diffusers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Air Stones & Diffusers > Air Diffusers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-2-2",
              name: "Disc Air Stones",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Air Stones & Diffusers > Disc Air Stones",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-2-3",
              name: "Standard Air Stones",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Air Stones & Diffusers > Standard Air Stones",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-2-4",
              name: "Tube Air Stones",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Air Stones & Diffusers > Tube Air Stones",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-2-5",
              name: "Wall Air Stones",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Air Stones & Diffusers > Wall Air Stones",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-3",
          name: "Aquarium Cleaning Supplies",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-1",
              name: "Algae Scrapers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Algae Scrapers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-2",
              name: "Aquarium Gloves",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Aquarium Gloves",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-3",
              name: "Cleaning Brushes",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Cleaning Brushes",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-4",
              name: "Cleaning Solutions",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Cleaning Solutions",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-5",
              name: "Gravel Vacuums",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Gravel Vacuums",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-6",
              name: "Scrub Pads",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Scrub Pads",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-7",
              name: "Siphons",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Siphons",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-3-8",
              name: "Tank Cleaners",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Cleaning Supplies > Tank Cleaners",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-4",
          name: "Aquarium Decors",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-1",
              name: "Aquarium Backgrounds",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Aquarium Backgrounds",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-2",
              name: "Aquarium Caves & Shelters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Aquarium Caves & Shelters",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-3",
              name: "Aquarium Rocks",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Aquarium Rocks",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-4",
              name: "Aquarium Substrates",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Aquarium Substrates",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-5",
              name: "Artificial Plants",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Artificial Plants",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-6",
              name: "Bubbling Decorations",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Bubbling Decorations",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-7",
              name: "Driftwood",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Driftwood",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-8",
              name: "Ornaments",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Ornaments",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-4-9",
              name: "Shipwrecks",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Decors > Shipwrecks",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-5",
          name: "Aquarium Filters",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Filters",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-5-1",
              name: "External & Canister Aquarium Filters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Filters > External & Canister Aquarium Filters",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-5-2",
              name: "Hang-On-Back (HOB) Aquarium Filters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Filters > Hang-On-Back (HOB) Aquarium Filters",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-5-3",
              name: "Internal Aquarium Filters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Filters > Internal Aquarium Filters",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-5-4",
              name: "Sponge Aquarium Filters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Filters > Sponge Aquarium Filters",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-5-5",
              name: "Undergravel Aquarium Filters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Filters > Undergravel Aquarium Filters",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-6",
          name: "Aquarium Fish Nets",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Fish Nets",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-6-1",
              name: "Scoop Nets",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Fish Nets > Scoop Nets",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-6-2",
              name: "Shrimp Nets",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Fish Nets > Shrimp Nets",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-6-3",
              name: "Sock Nets",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Fish Nets > Sock Nets",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-6-4",
              name: "Standard Nets",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Fish Nets > Standard Nets",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-7",
          name: "Aquarium Gravel & Substrates",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-1",
              name: "Aquarium Soil",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Aquarium Soil",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-2",
              name: "Aragonite Sands",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Aragonite Sands",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-3",
              name: "Crushed Corals",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Crushed Corals",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-4",
              name: "Glass Stones",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Glass Stones",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-5",
              name: "Gravel",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Gravel",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-6",
              name: "Pebbles",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Pebbles",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-7-7",
              name: "Sand",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Gravel & Substrates > Sand",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-8",
          name: "Aquarium Lighting",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Lighting",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-9",
          name: "Aquarium Overflow Boxes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Overflow Boxes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-10",
          name: "Aquarium Stands",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Stands",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-10-1",
              name: "Box Frame Stands",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Stands > Box Frame Stands",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-10-2",
              name: "Cabinet Stands",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Stands > Cabinet Stands",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-10-3",
              name: "Double Tank Stands",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Stands > Double Tank Stands",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-10-4",
              name: "Wrought Iron Stands",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Stands > Wrought Iron Stands",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-11",
          name: "Aquarium Temperature Controllers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Temperature Controllers",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-11-1",
              name: "Analog Temperature Controllers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Temperature Controllers > Analog Temperature Controllers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-11-2",
              name: "Digital Temperature Controllers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Temperature Controllers > Digital Temperature Controllers",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-12",
          name: "Aquarium Water Treatments",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-1",
              name: "Algae Control",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Algae Control",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-2",
              name: "Ammonia Removers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Ammonia Removers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-3",
              name: "Fungal & Bacterial Treatments",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Fungal & Bacterial Treatments",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-4",
              name: "Nitrate Removers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Nitrate Removers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-5",
              name: "PH Adjusters",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > PH Adjusters",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-6",
              name: "Tap Water Detoxifiers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Tap Water Detoxifiers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-7",
              name: "Water Clarifiers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Water Clarifiers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-12-8",
              name: "Water Conditioners",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquarium Water Treatments > Water Conditioners",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-13",
          name: "Aquariums",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquariums",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-14",
          name: "Aquatic Plant Fertilizers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquatic Plant Fertilizers",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-14-1",
              name: "Granular Fertilizers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquatic Plant Fertilizers > Granular Fertilizers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-14-2",
              name: "Liquid Fertilizers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquatic Plant Fertilizers > Liquid Fertilizers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-14-3",
              name: "Powder Fertilizers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquatic Plant Fertilizers > Powder Fertilizers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-14-4",
              name: "Tablet Fertilizers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Aquatic Plant Fertilizers > Tablet Fertilizers",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-15",
          name: "Fish Feeders",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Feeders",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-4-16",
          name: "Fish Food",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-1",
              name: "Algae Wafers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Algae Wafers",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-2",
              name: "Betta Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Betta Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-3",
              name: "Cichlid Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Cichlid Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-4",
              name: "Dry Fish Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Dry Fish Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-5",
              name: "Freeze-Dried Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Freeze-Dried Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-6",
              name: "Frozen Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Frozen Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-7",
              name: "Goldfish Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Goldfish Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-8",
              name: "Live Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Live Food",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-4-16-9",
              name: "Medicated Food",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Fish & Aquatic Supplies > Fish Food > Medicated Food",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14",
          name: "Pet Bowls, Feeders & Waterers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers",
          level: 2,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-1",
              name: "Automatic Feeders",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Automatic Feeders",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-2",
              name: "Bowls",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Bowls",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-3",
              name: "Elevated Bowls",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Elevated Bowls",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-4",
              name: "Gravity Feeders",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Gravity Feeders",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-5",
              name: "Slow Feeder Bowls",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Slow Feeder Bowls",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-6",
              name: "Travel Bowls",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Travel Bowls",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-7",
              name: "Water Dispensers",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Water Dispensers",
              level: 3,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-14-8",
              name: "Water Fountains",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Water Fountains",
              level: 3,
              children: []
            }
          ]
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-5",
      name: "Pet Agility Equipment",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-1",
          name: "A-Frames",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > A-Frames",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-2",
          name: "Agility Tunnels",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Agility Tunnels",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-3",
          name: "Dog Walks & Ramps",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Dog Walks & Ramps",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-4",
          name: "Jump Bars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Jump Bars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-5",
          name: "Pause Tables",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Pause Tables",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-6",
          name: "Poles",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Poles",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-7",
          name: "Teeter Boards",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Teeter Boards",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-5-8",
          name: "Tire Jumps",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Agility Equipment > Tire Jumps",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-6",
      name: "Pet Apparel",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-1",
          name: "Pet Bandanas",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Bandanas",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-2",
          name: "Pet Bows & Ribbons",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Bows & Ribbons",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-3",
          name: "Pet Coats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Coats",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-4",
          name: "Pet Collars & Ties",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Collars & Ties",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-5",
          name: "Pet Costumes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Costumes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-6",
          name: "Pet Dresses",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Dresses",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-7",
          name: "Pet Hats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Hats",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-8",
          name: "Pet Hoodies",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Hoodies",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-9",
          name: "Pet Jackets",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Jackets",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-10",
          name: "Pet Rain Coats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Rain Coats",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-11",
          name: "Pet Safety Vests",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Safety Vests",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-12",
          name: "Pet Scarves",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Scarves",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-13",
          name: "Pet Shirts",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Shirts",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-14",
          name: "Pet Shoes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Shoes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-15",
          name: "Pet Socks",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Socks",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-16",
          name: "Pet Sunglasses",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Sunglasses",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-6-17",
          name: "Pet Sweaters",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel > Pet Sweaters",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-7",
      name: "Pet Apparel Hangers",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Apparel Hangers",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-8",
      name: "Pet Bed Accessories",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bed Accessories",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-9",
      name: "Pet Beds",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-1",
          name: "Baskets",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Baskets",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-2",
          name: "Bolster Beds",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Bolster Beds",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-3",
          name: "Caves",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Caves",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-4",
          name: "Cooling Beds",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Cooling Beds",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-5",
          name: "Donuts",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Donuts",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-6",
          name: "Hammocks",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Hammocks",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-7",
          name: "Nests",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Nests",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-8",
          name: "Orthopedic Beds",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Orthopedic Beds",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-9",
          name: "Pet Chairs",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Pet Chairs",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-10",
          name: "Pet Cots",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Pet Cots",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-11",
          name: "Pillow Beds",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Pillow Beds",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-12",
          name: "Radiator Beds",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Radiator Beds",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-9-13",
          name: "Towers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Beds > Towers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-10",
      name: "Pet Bells & Charms",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bells & Charms",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-10-1",
          name: "Collar Bells",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bells & Charms > Collar Bells",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-10-2",
          name: "Collar Charms",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bells & Charms > Collar Charms",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-10-3",
          name: "ID Tag Charms",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bells & Charms > ID Tag Charms",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-11",
      name: "Pet Biometric Monitors",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Biometric Monitors",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-11-1",
          name: "Pet Glucose Meters",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Biometric Monitors > Pet Glucose Meters",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-11-2",
          name: "Pet Pedometers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Biometric Monitors > Pet Pedometers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-11-3",
          name: "Pet Thermometers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Biometric Monitors > Pet Thermometers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-12",
      name: "Pet Bowl Mats",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowl Mats",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-13",
      name: "Pet Bowl Stands",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowl Stands",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-14",
      name: "Pet Bowls, Feeders & Waterers",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-1",
          name: "Automatic Feeders",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Automatic Feeders",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-2",
          name: "Bowls",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Bowls",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-3",
          name: "Elevated Bowls",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Elevated Bowls",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-4",
          name: "Gravity Feeders",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Gravity Feeders",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-5",
          name: "Slow Feeder Bowls",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Slow Feeder Bowls",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-6",
          name: "Travel Bowls",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Travel Bowls",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-7",
          name: "Water Dispensers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Water Dispensers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-14-8",
          name: "Water Fountains",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Bowls, Feeders & Waterers > Water Fountains",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-15",
      name: "Pet Carrier & Crate Accessories",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carrier & Crate Accessories",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-16",
      name: "Pet Carriers & Crates",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-1",
          name: "Air Travel Approved Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Air Travel Approved Carriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-2",
          name: "Backpack Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Backpack Carriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-3",
          name: "Car Crates",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Car Crates",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-4",
          name: "Furniture-Style Crates",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Furniture-Style Crates",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-5",
          name: "Hard-Sided Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Hard-Sided Carriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-8",
          name: "Rolling Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Rolling Carriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-9",
          name: "Slings & Wearable Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Slings & Wearable Carriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-10",
          name: "Soft-Sided Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Soft-Sided Carriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-11",
          name: "Soft-Sided Crates",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Soft-Sided Crates",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-16-12",
          name: "Wheeled Carriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Carriers & Crates > Wheeled Carriers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-17",
      name: "Pet Collars & Harnesses",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-1",
          name: "Breakaway & Safety Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Breakaway & Safety Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-2",
          name: "Flea Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Flea Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-3",
          name: "GPS Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > GPS Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-4",
          name: "Harnesses",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Harnesses",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-5",
          name: "LED Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > LED Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-6",
          name: "Martingale Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Martingale Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-7",
          name: "Personalized ID Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Personalized ID Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-8",
          name: "Standard Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Standard Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-9",
          name: "Training, Choke & Pinch Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Training, Choke & Pinch Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-17-10",
          name: "Vests",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Collars & Harnesses > Vests",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-18",
      name: "Pet Containment Systems",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-18-1",
          name: "Electronic Invisible Fences",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems > Electronic Invisible Fences",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-18-2",
          name: "Enclosures & Cages",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems > Enclosures & Cages",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-18-3",
          name: "Exercise Pens",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems > Exercise Pens",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-18-4",
          name: "Fences & Gates",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems > Fences & Gates",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-18-5",
          name: "Kennels",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems > Kennels",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-18-6",
          name: "Playpens",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Containment Systems > Playpens",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-19",
      name: "Pet Door Accessories",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Door Accessories",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-20",
      name: "Pet Doors",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Doors",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-20-1",
          name: "Door-Mounted Doors",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Doors > Door-Mounted Doors",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-20-2",
          name: "Electronic Automatic Doors",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Doors > Electronic Automatic Doors",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-20-3",
          name: "Sliding Glass Doors",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Doors > Sliding Glass Doors",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-20-4",
          name: "Wall-Mounted Doors",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Doors > Wall-Mounted Doors",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-20-5",
          name: "Window-Mounted Doors",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Doors > Window-Mounted Doors",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-21",
      name: "Pet Eye Drops & Lubricants",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-21-1",
          name: "Conjunctivitis Treatments",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants > Conjunctivitis Treatments",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-21-2",
          name: "Eye Cleaners",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants > Eye Cleaners",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-21-3",
          name: "Eye Irrigation Solutions",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants > Eye Irrigation Solutions",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-21-4",
          name: "Eye Lubricants",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants > Eye Lubricants",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-21-5",
          name: "Eye Washes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants > Eye Washes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-21-6",
          name: "Tear Stain Removers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Eye Drops & Lubricants > Tear Stain Removers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-22",
      name: "Pet First Aid & Emergency Kits",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet First Aid & Emergency Kits",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-22-1",
          name: "General First Aid Kits",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet First Aid & Emergency Kits > General First Aid Kits",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-22-2",
          name: "Trauma Kits",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet First Aid & Emergency Kits > Trauma Kits",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-22-3",
          name: "Travel First Aid Kits",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet First Aid & Emergency Kits > Travel First Aid Kits",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-23",
      name: "Pet Flea & Tick Control",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-1",
          name: "Flea & Tick Collars",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Flea & Tick Collars",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-2",
          name: "Flea & Tick Foggers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Flea & Tick Foggers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-3",
          name: "Flea & Tick Shampoos",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Flea & Tick Shampoos",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-4",
          name: "Flea & Tick Sprays",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Flea & Tick Sprays",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-5",
          name: "Flea Combs",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Flea Combs",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-6",
          name: "Oral Medication",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Oral Medication",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-23-7",
          name: "Spot Treatments",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Flea & Tick Control > Spot Treatments",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-24",
      name: "Pet Food Containers",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Food Containers",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-24-1",
          name: "Can Covers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Food Containers > Can Covers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-24-2",
          name: "Food Storage Bins",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Food Containers > Food Storage Bins",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-24-3",
          name: "Food Storage Containers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Food Containers > Food Storage Containers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-25",
      name: "Pet Food Scoops",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Food Scoops",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-26",
      name: "Pet Grooming Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-1",
          name: "Pet Combs & Brushes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Combs & Brushes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-2",
          name: "Pet Fragrances & Deodorizing Sprays",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Fragrances & Deodorizing Sprays",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-3",
          name: "Pet Hair Clippers & Trimmers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Hair Clippers & Trimmers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-4",
          name: "Pet Hair Dryers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Hair Dryers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-5",
          name: "Pet Nail Polish",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Nail Polish",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-6",
          name: "Pet Nail Tools",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Nail Tools",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-7",
          name: "Pet Shampoo & Conditioner",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Shampoo & Conditioner",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-26-8",
          name: "Pet Wipes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Grooming Supplies > Pet Wipes",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-27",
      name: "Pet Heating Pad Accessories",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Heating Pad Accessories",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-28",
      name: "Pet Heating Pads",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Heating Pads",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-29",
      name: "Pet ID Tags",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet ID Tags",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-29-1",
          name: "Digital QR Code Tags",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet ID Tags > Digital QR Code Tags",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-29-2",
          name: "Embroidered Tags",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet ID Tags > Embroidered Tags",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-29-3",
          name: "Medical Alert Tags",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet ID Tags > Medical Alert Tags",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-29-4",
          name: "Slide-On Collar Tags",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet ID Tags > Slide-On Collar Tags",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-30",
      name: "Pet Leash Extensions",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Leash Extensions",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-31",
      name: "Pet Leashes",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Leashes",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-32",
      name: "Pet Medical Collars",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medical Collars",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-33",
      name: "Pet Medical Tape & Bandages",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medical Tape & Bandages",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-34",
      name: "Pet Medicine",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-1",
          name: "Allergy Relief",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Allergy Relief",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-2",
          name: "Antibiotics",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Antibiotics",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-3",
          name: "Antiparasitics",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Antiparasitics",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-4",
          name: "Anxiety Relief",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Anxiety Relief",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-5",
          name: "Digestive Aids",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Digestive Aids",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-6",
          name: "Ear & Eye Medicine",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Ear & Eye Medicine",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-34-7",
          name: "Pain Relievers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Medicine > Pain Relievers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-35",
      name: "Pet Muzzles",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Muzzles",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-36",
      name: "Pet Oral Care Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-1",
          name: "Dental Chews",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Dental Chews",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-2",
          name: "Dental Gels",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Dental Gels",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-3",
          name: "Dental Sprays",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Dental Sprays",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-5",
          name: "Dental Water Additives",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Dental Water Additives",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-6",
          name: "Dental Wipes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Dental Wipes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-7",
          name: "Oral Rinses",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Oral Rinses",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-8",
          name: "Toothbrushes",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Toothbrushes",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-36-9",
          name: "Toothpaste",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Oral Care Supplies > Toothpaste",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-37",
      name: "Pet Steps & Ramps",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Steps & Ramps",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-39",
      name: "Pet Strollers",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Strollers",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-39-1",
          name: "Detachable Carrier Pet Strollers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Strollers > Detachable Carrier Pet Strollers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-39-2",
          name: "Double-Decker Strollers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Strollers > Double-Decker Strollers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-39-3",
          name: "Jogging Strollers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Strollers > Jogging Strollers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-39-4",
          name: "Multi-Strollers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Strollers > Multi-Strollers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-39-5",
          name: "Standard Strollers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Strollers > Standard Strollers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-40",
      name: "Pet Sunscreen",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Sunscreen",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-41",
      name: "Pet Training Aids",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-41-1",
          name: "Pet Training Clickers & Treat Dispensers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Clickers & Treat Dispensers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-41-2",
          name: "Pet Training Pad Holders",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Pad Holders",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-41-2-1",
              name: "Grid-Top Pad Holders",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Pad Holders > Grid-Top Pad Holders",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-41-2-2",
              name: "Regular Pad Holders",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Pad Holders > Regular Pad Holders",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-41-2-3",
              name: "Wall-Mounted Pad Holders",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Pad Holders > Wall-Mounted Pad Holders",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-41-3",
          name: "Pet Training Pads",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Pads",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-41-4",
          name: "Pet Training Sprays & Solutions",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Training Aids > Pet Training Sprays & Solutions",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-42",
      name: "Pet Vitamins & Supplements",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-1",
          name: "CBD Supplements",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > CBD Supplements",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-2",
          name: "Calcium",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Calcium",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-3",
          name: "Dental Health",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Dental Health",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-4",
          name: "Fish Oil",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Fish Oil",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-5",
          name: "Immune Support",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Immune Support",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-6",
          name: "Joint Health",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Joint Health",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-7",
          name: "Multi-Vitamins",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Multi-Vitamins",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-8",
          name: "Probiotics",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Probiotics",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-9",
          name: "Skin & Coat",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Skin & Coat",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-42-10",
          name: "Weight Control",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Vitamins & Supplements > Weight Control",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-43",
      name: "Pet Waste Bag Dispensers & Holders",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Bag Dispensers & Holders",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-43-1",
          name: "Flashlight Dispensers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Bag Dispensers & Holders > Flashlight Dispensers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-43-2",
          name: "Standard Dispensers & Holders",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Bag Dispensers & Holders > Standard Dispensers & Holders",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-43-3",
          name: "Storage Dispensers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Bag Dispensers & Holders > Storage Dispensers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-44",
      name: "Pet Waste Bags",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Bags",
      level: 2,
      children: []
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-45",
      name: "Pet Waste Disposal Systems & Tools",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Disposal Systems & Tools",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-45-1",
          name: "Doggy Bags",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Disposal Systems & Tools > Doggy Bags",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-45-2",
          name: "Litter Trays",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Disposal Systems & Tools > Litter Trays",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-45-3",
          name: "Pet Waste Disposal Systems",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Disposal Systems & Tools > Pet Waste Disposal Systems",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-45-4",
          name: "Waste Scoopers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Pet Waste Disposal Systems & Tools > Waste Scoopers",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-46",
      name: "Reptile & Amphibian Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-46-1",
          name: "Reptile & Amphibian Food",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Food",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-46-2",
          name: "Reptile & Amphibian Habitat Accessories",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitat Accessories",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-46-3",
          name: "Reptile & Amphibian Habitat Heating & Lighting",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitat Heating & Lighting",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-46-4",
          name: "Reptile & Amphibian Habitats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitats",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-46-4-1",
              name: "Aquariums",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitats > Aquariums",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-46-4-2",
              name: "Paludariums",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitats > Paludariums",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-46-4-3",
              name: "Terrariums",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitats > Terrariums",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-46-4-4",
              name: "Vivariums",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Habitats > Vivariums",
              level: 4,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-46-5",
          name: "Reptile & Amphibian Substrates",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Reptile & Amphibian Supplies > Reptile & Amphibian Substrates",
          level: 3,
          children: []
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-47",
      name: "Small Animal Supplies",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-47-1",
          name: "Small Animal Bedding",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Bedding",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-47-2",
          name: "Small Animal Food",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Food",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-47-3",
          name: "Small Animal Habitat Accessories",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Habitat Accessories",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-47-4",
          name: "Small Animal Habitats & Cages",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Habitats & Cages",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-47-5",
          name: "Small Animal Treats",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats",
          level: 3,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-47-5-1",
              name: "Biscuits & Bakery",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats > Biscuits & Bakery",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-47-5-2",
              name: "Chew Treats",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats > Chew Treats",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-47-5-3",
              name: "Crunchy Treats",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats > Crunchy Treats",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-47-5-4",
              name: "Soft Treats",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats > Soft Treats",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-47-5-5",
              name: "Stick Treats",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats > Stick Treats",
              level: 4,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ap-2-47-5-6",
              name: "Training Treats",
              fullPath: "Animals & Pet Supplies > Pet Supplies > Small Animal Supplies > Small Animal Treats > Training Treats",
              level: 4,
              children: []
            }
          ]
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ap-2-48",
      name: "Vehicle Pet Barriers",
      fullPath: "Animals & Pet Supplies > Pet Supplies > Vehicle Pet Barriers",
      level: 2,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-48-1",
          name: "Backseat Barriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Vehicle Pet Barriers > Backseat Barriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-48-2",
          name: "Cargo Area Barriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Vehicle Pet Barriers > Cargo Area Barriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-48-3",
          name: "Door Barriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Vehicle Pet Barriers > Door Barriers",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-48-4",
          name: "Partitions",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Vehicle Pet Barriers > Partitions",
          level: 3,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2-48-5",
          name: "Window Barriers",
          fullPath: "Animals & Pet Supplies > Pet Supplies > Vehicle Pet Barriers > Window Barriers",
          level: 3,
          children: []
        }
      ]
    }
  ];
}

/**
 * Retourne un ensemble basique de catégories si le chargement normal échoue
 * Cette version inclut quelques sous-catégories pour démontrer la hiérarchie
 */
export function getBasicCategories(): TaxonomyNode[] {
  console.log('[TaxonomyService] Using fallback basic categories with sample sub-categories');
  
  // Inclure les 26 catégories principales de Shopify avec quelques sous-catégories d'exemple
  return [
    {
      id: "gid://shopify/TaxonomyCategory/ap",
      name: "Animals & Pet Supplies",
      fullPath: "Animals & Pet Supplies",
      level: 0,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ap-1",
          name: "Live Animals",
          fullPath: "Animals & Pet Supplies > Live Animals",
          level: 1,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/ap-2",
          name: "Pet Supplies",
          fullPath: "Animals & Pet Supplies > Pet Supplies",
          level: 1,
          children: getDetailedPetSuppliesCategories()
        }
      ]
    },
    {
      id: "gid://shopify/TaxonomyCategory/ad",
      name: "Apparel & Accessories",
      fullPath: "Apparel & Accessories",
      level: 0,
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/ad-1",
          name: "Clothing",
          fullPath: "Apparel & Accessories > Clothing",
          level: 1,
          children: [
            {
              id: "gid://shopify/TaxonomyCategory/ad-1-1",
              name: "Men's Clothing",
              fullPath: "Apparel & Accessories > Clothing > Men's Clothing",
              level: 2,
              children: []
            },
            {
              id: "gid://shopify/TaxonomyCategory/ad-1-2",
              name: "Women's Clothing",
              fullPath: "Apparel & Accessories > Clothing > Women's Clothing",
              level: 2,
              children: []
            }
          ]
        },
        {
          id: "gid://shopify/TaxonomyCategory/ad-2",
          name: "Jewelry",
          fullPath: "Apparel & Accessories > Jewelry",
          level: 1,
          children: []
        }
      ]
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
      id: "gid://shopify/TaxonomyCategory/bun",
      name: "Bundles",
      fullPath: "Bundles",
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
      children: [
        {
          id: "gid://shopify/TaxonomyCategory/el-1",
          name: "Computers",
          fullPath: "Electronics > Computers",
          level: 1,
          children: []
        },
        {
          id: "gid://shopify/TaxonomyCategory/el-2",
          name: "Audio Equipment",
          fullPath: "Electronics > Audio Equipment",
          level: 1,
          children: []
        }
      ]
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
