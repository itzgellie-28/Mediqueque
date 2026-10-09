// Tell TypeScript about Tailwind CSS v4 custom syntax
// This allows TypeScript to recognize @theme and other Tailwind v4 directives

declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Allow @theme at-rule in CSS
declare namespace CSS {
  namespace atRules {
    const theme: any;
  }
}