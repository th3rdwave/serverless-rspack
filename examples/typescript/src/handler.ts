export const hello = async (event) => {
  return {
    message:
      'Hello Serverless Webpack (Typescript) v1.0! Your function executed successfully!',
    event,
  };
};
