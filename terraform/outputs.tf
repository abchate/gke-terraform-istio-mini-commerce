output "cluster_name" {
  description = "Nom du cluster GKE"
  value       = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  description = "Endpoint du cluster GKE"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "region" {
  description = "Region du cluster"
  value       = var.region
}

output "zone" {
  description = "Zone du cluster"
  value       = var.zone
}

output "kubectl_config_command" {
  description = "Commande pour configurer kubectl"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --zone ${var.zone} --project ${var.project_id}"
}
