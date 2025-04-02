/**
 * @author Manar Bakhat
*/
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

export async function handleTitleEdit(request: Request, formData: FormData) {
  const { admin } = await authenticate.admin(request);
  const productIds = formData.get("productIds") as string;
  const productIdsArray = JSON.parse(productIds);
  const textToAdd = formData.get("textToAdd") as string;
  const editType = formData.get("editType") as string;
  const replacementText = formData.get("replacementText") as string;
  const capitalizationType = formData.get("capitalizationType") as string;
  const numberOfCharacters = parseInt(formData.get("numberOfCharacters") as string);
  const productTitles = JSON.parse(formData.get("productTitles") as string);

  try {
    // Update each product's title
    for (const productId of productIdsArray) {
      await updateProductTitle(admin, productId, editType, textToAdd, replacementText, capitalizationType, numberOfCharacters, productTitles);
    }

    return json({ success: true });
  } catch (error) {
    console.error('Error updating products:', error);
    return json({ error: 'Failed to update products' });
  }
}

async function updateProductTitle(
  admin: any,
  productId: string,
  editType: string,
  textToAdd: string,
  replacementText: string,
  capitalizationType: string,
  numberOfCharacters: number,
  productTitles: { [key: string]: string }
) {
  const mutation = `#graphql
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const currentTitle = productTitles[productId] || '';
  let newTitle = currentTitle;

  switch (editType) {
    case 'addTextBeginning':
      newTitle = `${textToAdd} ${currentTitle}`;
      break;
    case 'addTextEnd':
      newTitle = `${currentTitle} ${textToAdd}`;
      break;
    case 'removeText':
      // Create a case-insensitive regex pattern
      const regex = new RegExp(textToAdd, 'gi');
      newTitle = currentTitle.replace(regex, '').trim();
      break;
    case 'replaceText':
      // Create a case-insensitive regex pattern for replacement
      const replaceRegex = new RegExp(textToAdd, 'gi');
      newTitle = currentTitle.replace(replaceRegex, replacementText);
      break;
    case 'capitalize':
      switch (capitalizationType) {
        case 'titleCase':
          newTitle = currentTitle
            .toLowerCase()
            .split(' ')
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          break;
        case 'uppercase':
          newTitle = currentTitle.toUpperCase();
          break;
        case 'lowercase':
          newTitle = currentTitle.toLowerCase();
          break;
        case 'firstLetter':
          newTitle = currentTitle.charAt(0).toUpperCase() + currentTitle.slice(1).toLowerCase();
          break;
      }
      break;
    case 'truncate':
      if (numberOfCharacters > 0) {
        newTitle = currentTitle.slice(0, numberOfCharacters);
      }
      break;
  }

  const variables = {
    input: {
      id: `gid://shopify/Product/${productId}`,
      title: newTitle
    }
  };

  await admin.graphql(mutation, {
    variables: variables
  });
} 