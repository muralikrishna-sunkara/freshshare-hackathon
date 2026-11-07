import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../api/client";

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
