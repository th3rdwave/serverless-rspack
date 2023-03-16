export const goodbye = async (event) => {
  return {
    message:
      'Goodbye Serverless Webpack (Typescript) v1.0! Your function executed successfully!',
    event,
  };
};
