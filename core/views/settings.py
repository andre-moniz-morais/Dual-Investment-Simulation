from rest_framework import viewsets, mixins
from rest_framework.response import Response
from core.models import Settings
from core.serializers import SettingsSerializer


class SettingsViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Singleton ViewSet — always operates on the single Settings row."""
    serializer_class = SettingsSerializer

    def get_object(self):
        obj = Settings.objects.first()
        self.check_object_permissions(self.request, obj)
        return obj

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response({'detail': 'Settings not configured.'}, status=404)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response({'detail': 'Settings not configured.'}, status=404)
        serializer = self.get_serializer(instance, data=request.data, partial=kwargs.pop('partial', False))
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
