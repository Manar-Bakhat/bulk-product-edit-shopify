/**
 * Utility functions for filtering products
 * This module contains functions to handle product filtering logic
 */

import type { Product } from '../types/product';

/**
 * Builds a GraphQL query string based on filter criteria
 */
export function buildFilterQuery(field: string, condition: string, value: string): string {
  if (!value) return '';

  const fieldMap: { [key: string]: string } = {
    title: 'title',
    collection: 'collection',
    productId: 'id',
    description: 'description',
    price: 'variants.price'
  };

  const searchField = fieldMap[field] || field;
  const escapedValue = value.replace(/['"]/g, '').trim();

  switch (condition) {
    case 'is':
      return `${searchField}:'${escapedValue}'`;
    case 'contains':
      return `${searchField}:*${escapedValue}*`;
    case 'doesNotContain':
      return `-${searchField}:*${escapedValue}*`;
    case 'startsWith':
    case 'endsWith':
      return `${searchField}:*${escapedValue}*`;
    default:
      return '';
  }
}

/**
 * Filters products based on selected criteria
 * @param products Array of products to filter
 * @param field Field to filter on (title, description, productId)
 * @param condition Filter condition (contains, doesNotContain, etc.)
 * @param value Filter value
 * @returns Filtered array of products
 */
export function filterProducts(
  products: Product[],
  field: string,
  condition: string,
  value: string
): Product[] {
  return products.filter(product => {
    const fieldValue = field === 'productId' ? product.id : 
                      field === 'title' ? product.title : 
                      product.description || '';

    switch (condition) {
      case 'contains':
        return fieldValue.toLowerCase().includes(value.toLowerCase());
      case 'doesNotContain':
        return !fieldValue.toLowerCase().includes(value.toLowerCase());
      case 'startsWith':
        return fieldValue.toLowerCase().startsWith(value.toLowerCase());
      case 'endsWith':
        return fieldValue.toLowerCase().endsWith(value.toLowerCase());
      case 'is':
        return fieldValue.toLowerCase() === value.toLowerCase();
      case 'empty':
        return !fieldValue.trim();
      default:
        return true;
    }
  });
} 