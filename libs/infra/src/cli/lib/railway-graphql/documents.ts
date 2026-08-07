import { graphql } from './graphql';

export const MeIdQuery = graphql(`
  query MeId {
    me {
      id
    }
  }
`);

export const ListProjectsQuery = graphql(`
  query ListProjects {
    me {
      workspaces {
        id
        name
        projects(first: 100) {
          edges {
            node {
              id
              name
              environments(first: 20) {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
              services(first: 50) {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

export const ProjectCreateMutation = graphql(`
  mutation ProjectCreate($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      id
      name
      environments {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
`);

export const ServiceCreateMutation = graphql(`
  mutation ServiceCreate($input: ServiceCreateInput!) {
    serviceCreate(input: $input) {
      id
      name
    }
  }
`);

export const ServiceInstanceUpdateMutation = graphql(`
  mutation ServiceInstanceUpdate(
    $serviceId: String!
    $environmentId: String
    $input: ServiceInstanceUpdateInput!
  ) {
    serviceInstanceUpdate(
      serviceId: $serviceId
      environmentId: $environmentId
      input: $input
    )
  }
`);

export const VariableUpsertMutation = graphql(`
  mutation VariableUpsert($input: VariableUpsertInput!) {
    variableUpsert(input: $input)
  }
`);

export const DomainsQuery = graphql(`
  query Domains(
    $environmentId: String!
    $projectId: String!
    $serviceId: String!
  ) {
    domains(
      environmentId: $environmentId
      projectId: $projectId
      serviceId: $serviceId
    ) {
      customDomains {
        id
        domain
        status {
          verificationToken
          dnsRecords {
            recordType
            requiredValue
          }
        }
      }
    }
  }
`);

export const CustomDomainCreateMutation = graphql(`
  mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
    customDomainCreate(input: $input) {
      id
      domain
      status {
        verificationToken
        dnsRecords {
          recordType
          requiredValue
        }
      }
    }
  }
`);

export const ServiceDomainCreateMutation = graphql(`
  mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
    serviceDomainCreate(input: $input) {
      domain
    }
  }
`);

export const VolumeCreateMutation = graphql(`
  mutation VolumeCreate($input: VolumeCreateInput!) {
    volumeCreate(input: $input) {
      id
    }
  }
`);

export const ServiceInstanceRedeployMutation = graphql(`
  mutation ServiceInstanceRedeploy(
    $serviceId: String!
    $environmentId: String!
  ) {
    serviceInstanceRedeploy(
      serviceId: $serviceId
      environmentId: $environmentId
    )
  }
`);

export const ServiceInstanceDeployV2Mutation = graphql(`
  mutation ServiceInstanceDeployV2(
    $serviceId: String!
    $environmentId: String!
  ) {
    serviceInstanceDeployV2(
      serviceId: $serviceId
      environmentId: $environmentId
    )
  }
`);

export const ServiceDeleteMutation = graphql(`
  mutation ServiceDelete($id: String!) {
    serviceDelete(id: $id)
  }
`);
