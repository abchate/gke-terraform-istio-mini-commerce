variable "project_id" {
  description = "ID du projet Google Cloud"
  type        = string
}

variable "region" {
  description = "Region GCP"
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  description = "Zone GCP"
  type        = string
  default     = "europe-west1-b"
}

variable "cluster_name" {
  description = "Nom du cluster GKE"
  type        = string
  default     = "mini-commerce-cluster"
}

variable "node_count" {
  description = "Nombre de noeuds dans le cluster"
  type        = number
  default     = 2
}

variable "machine_type" {
  description = "Type de machine GCP"
  type        = string
  default     = "e2-medium"
}
