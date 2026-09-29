from django import forms

from .models import Feedback, Game, Rulebook, User, UserGame


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["display_name"]


class GameForm(forms.ModelForm):
    class Meta:
        model = Game
        fields = ["category", "min_players", "max_players", "playing_time"]

    def clean(self):
        data = super().clean()
        if (
            data.get("min_players")
            and data.get("max_players")
            and data["min_players"] > data["max_players"]
        ):
            raise forms.ValidationError("Minimum players cannot exceed maximum players.")
        return data


class CollectionForm(forms.ModelForm):
    class Meta:
        model = UserGame
        fields = ["owned", "wishlist", "wishlist_priority", "wishlist_note"]
        widgets = {"wishlist_note": forms.Textarea(attrs={"rows": 2})}


class RatingForm(forms.ModelForm):
    rating = forms.FloatField(min_value=1, max_value=10)

    class Meta:
        model = UserGame
        fields = ["rating", "comment"]
        widgets = {"comment": forms.Textarea(attrs={"rows": 3})}


class FeedbackForm(forms.ModelForm):
    class Meta:
        model = Feedback
        fields = ["title", "category", "description"]
        widgets = {"description": forms.Textarea(attrs={"rows": 4})}


class RulebookForm(forms.ModelForm):
    class Meta:
        model = Rulebook
        fields = ["game", "module_name", "module_type", "source", "content_md"]
        widgets = {"content_md": forms.Textarea(attrs={"rows": 18})}
