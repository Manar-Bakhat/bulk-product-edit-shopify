/**
 * @author Manar Bakhat
 */
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";

export async function handleDescriptionEdit(request: Request, formData: FormData) {
  console.log('[DescriptionEditService] Starting description edit process');
  const { admin } = await authenticate.admin(request);
  const productIds = formData.getAll("productIds[]") as string[];
  const textToAdd = formData.get("text") as string;
  const position = formData.get("position") as string;

  console.log('[DescriptionEditService] Input data:', {
    productIds,
    textToAdd,
    position
  });

  try {
    // Update each product's description
    for (const productId of productIds) {
      console.log(`[DescriptionEditService] Processing product ${productId}`);
      await updateProductDescription(admin, productId, textToAdd, position);
    }

    console.log('[DescriptionEditService] All products updated successfully');
    return json({ success: true });
  } catch (error) {
    console.error('[DescriptionEditService] Error updating descriptions:', error);
    return json({ error: 'Failed to update descriptions' });
  }
}

async function updateProductDescription(
  admin: any,
  productId: string,
  textToAdd: string,
  position: string
) {
  console.log(`[DescriptionEditService] Updating description for product ${productId}`);
  
  // First, get the current product description
  const getProductQuery = `#graphql
    query {
      product(id: "gid://shopify/Product/${productId}") {
        id
        descriptionHtml
      }
    }
  `;

  console.log('[DescriptionEditService] Fetching current product description...');
  const productResponse = await admin.graphql(getProductQuery);
  const productData = await productResponse.json();

  if (productData.errors) {
    console.error('[DescriptionEditService] GraphQL errors:', productData.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(productData.errors)}`);
  }

  const currentDescription = productData.data?.product?.descriptionHtml || '';
  console.log('[DescriptionEditService] Current description:', currentDescription);

  let newDescription = currentDescription;

  // Update description based on position
  if (position === 'beginning') {
    newDescription = `${textToAdd} ${currentDescription}`;
  } else if (position === 'end') {
    newDescription = `${currentDescription} ${textToAdd}`;
  }

  console.log('[DescriptionEditService] New description:', newDescription);

  // Update the product with new description
  const mutation = `#graphql
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          descriptionHtml
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: `gid://shopify/Product/${productId}`,
      descriptionHtml: newDescription
    }
  };

  console.log('[DescriptionEditService] Sending update mutation with variables:', variables);
  const updateResponse = await admin.graphql(mutation, {
    variables: variables
  });

  const updateData = await updateResponse.json();
  console.log('[DescriptionEditService] Update response:', updateData);

  if (updateData.errors) {
    console.error('[DescriptionEditService] Update mutation errors:', updateData.errors);
    throw new Error(`Update mutation errors: ${JSON.stringify(updateData.errors)}`);
  }

  const userErrors = updateData.data?.productUpdate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    console.error('[DescriptionEditService] User errors:', userErrors);
    throw new Error(`User errors: ${JSON.stringify(userErrors)}`);
  }

  console.log(`[DescriptionEditService] Successfully updated description for product ${productId}`);
} 