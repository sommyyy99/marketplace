import wrapsBurgers from '../assets/images/image.png';
import egusiSoup from '../assets/images/494555509_4031516693793297_2131975294073460328_n.jpg';
import jollofRice from '../assets/images/delicious-jollof-rice-with-grilled-chicken-and-fried-plantains-photo.jpg';
import bakedChicken from '../assets/images/Baked-Chicken-Legs-7-of-7-750x750.jpg';

export interface Product {
  id: string;
  name: string;
  vendor: string;
  description: string;
  price: number;
  category: string;
  image: string;
}

export interface Category {
  id: string;
  label: string;
}

export interface Vendor {
  id: string;
  name: string;
  initials: string;
  rating: number;
  distance: string;
  color: string;
}

export const categories: Category[] = [
  { id: 'all', label: 'All' },
  { id: 'grills', label: 'Grills' },
  { id: 'soups', label: 'Soups' },
  { id: 'rice', label: 'Rice' },
  { id: 'wraps', label: 'Wraps' },
  { id: 'burgers', label: 'Burgers' },
];

export const products: Product[] = [
  {
    id: '1',
    name: 'Barbecue Chicken',
    vendor: 'Mama Tola Foods',
    description: 'Smoky grilled chicken with spicy pepper sauce',
    price: 8500,
    category: 'grills',
    image: bakedChicken,
  },
  {
    id: '2',
    name: 'Egusi Soup',
    vendor: 'Green Basket',
    description: 'Rich melon seed soup with assorted meat and fish',
    price: 7200,
    category: 'soups',
    image: egusiSoup,
  },
  {
    id: '3',
    name: 'Jollof Rice',
    vendor: 'Amina Stores',
    description: 'Smoky party-style jollof rice with fried plantain',
    price: 6400,
    category: 'rice',
    image: jollofRice,
  },
  {
    id: '4',
    name: 'Shawarma',
    vendor: 'Bukateria Hub',
    description: 'Grilled chicken shawarma wrap with veggies and sauce',
    price: 4500,
    category: 'wraps',
    image: wrapsBurgers,
  },
  {
    id: '5',
    name: 'Beef Burger',
    vendor: 'Daily Needs Shop',
    description: 'Juicy beef patty with cheese, lettuce, and tomato',
    price: 5500,
    category: 'burgers',
    image: wrapsBurgers,
  },
  {
    id: '6',
    name: 'Chicken Burger',
    vendor: 'QuickMeds',
    description: 'Crispy chicken fillet burger with special sauce',
    price: 5200,
    category: 'burgers',
    image: wrapsBurgers,
  },
];

export const vendors: Vendor[] = [
  { id: '1', name: 'Mama Tola Foods', initials: 'MT', rating: 4.9, distance: '0.6 mi', color: 'orange' },
  { id: '2', name: 'Green Basket', initials: 'GB', rating: 4.8, distance: '0.9 mi', color: 'teal' },
  { id: '3', name: 'Daily Needs Shop', initials: 'DN', rating: 4.7, distance: '1.1 mi', color: 'slate' },
];

export const initialBasketItems = [
  { id: 'b1', name: 'Barbecue Chicken', price: 8500 },
  { id: 'b2', name: 'Jollof Rice', price: 6400 },
];

export const deliveryFee = 2500;
export const serviceFee = 700;
